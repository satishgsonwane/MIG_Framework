import os
import numpy as np
import tkinter as tk
from tkinter import filedialog
from tkinter import messagebox
import cv2
import onnxruntime as ort
import argparse
import json
import sys
import traceback

def analyze_image(image_path):
    try:
        # Load the ONNX models
        print("Loading ONNX models...", file=sys.stderr)
        net2_session = ort.InferenceSession("net2.onnx")
        net5_session = ort.InferenceSession("net5.onnx")
        print("Models loaded successfully", file=sys.stderr)
        
        # Print input shapes for debugging
        print(f"Net2 input shape: {net2_session.get_inputs()[0].shape}", file=sys.stderr)
        print(f"Net5 input shape: {net5_session.get_inputs()[0].shape}", file=sys.stderr)
    except Exception as e:
        print(f"Error loading models: {str(e)}", file=sys.stderr)
        return {"error": f"Failed to load models: {str(e)}"}

    try:
        # Read the selected image
        image = cv2.imread(image_path)
        if image is None:
            print(f"Failed to read image: {image_path}", file=sys.stderr)
            return {"error": f"Failed to read image: {image_path}"}
        
        print(f"Image loaded successfully: {image_path}", file=sys.stderr)
        
        # Resize the image to 100x100
        resized_image = cv2.resize(image, (100, 100))
        
        # Convert to grayscale
        gray_image = cv2.cvtColor(resized_image, cv2.COLOR_BGR2GRAY)
        
        # Process image for model input - reshape to match expected dimensions
        processed_image = gray_image.astype(np.float32) / 255.0
        
        # Get input shape information from the model
        net2_input_shape = net2_session.get_inputs()[0].shape
        print(f"Expected input shape for net2: {net2_input_shape}", file=sys.stderr)
        
        # Reshape according to the expected input shape
        # Typically ONNX models expect [batch_size, channels, height, width]
        if len(net2_input_shape) == 4:  # [batch, channels, height, width]
            processed_image = processed_image.reshape(1, 1, 100, 100)
        else:
            # Fallback to original processing if shape is unexpected
            processed_image = np.expand_dims(processed_image, axis=0)  # Add batch dimension
            processed_image = np.expand_dims(processed_image, axis=1)  # Add channel dimension as second dimension
        
        print(f"Processed image shape: {processed_image.shape}", file=sys.stderr)
        
        # Get input and output names for net2
        net2_input_name = net2_session.get_inputs()[0].name
        net2_output_name = net2_session.get_outputs()[0].name
        
        # Run inference on net2
        result = net2_session.run([net2_output_name], {net2_input_name: processed_image})
        prediction = result[0]
        
        # Debug the prediction values
        print(f"Raw prediction values: {prediction}", file=sys.stderr)
        
        class_index = np.argmax(prediction)
        print(f"Class index: {class_index}", file=sys.stderr)
        
        classes = ['Good Weld', 'Bad Weld']
        classification = classes[class_index]
        print(f"Classification: {classification}", file=sys.stderr)
        print(f"Confidence: {float(prediction[0][class_index])}", file=sys.stderr)
        
        # Initialize result dictionary
        analysis_result = {
            "classification": classification,
            "confidence": float(prediction[0][class_index])
        }
        
        if classification == 'Bad Weld':
            print("Bad weld detected, running defect classification with net5", file=sys.stderr)
            # Get input and output names for net5
            net5_input_name = net5_session.get_inputs()[0].name
            net5_output_name = net5_session.get_outputs()[0].name
            
            # Run inference on net5 for specific defect classification
            # Use the same processed image shape as for net2
            result = net5_session.run([net5_output_name], {net5_input_name: processed_image})
            defect_prediction = result[0]
            
            # Debug the defect prediction values
            print(f"Raw defect prediction values: {defect_prediction}", file=sys.stderr)
            
            defect_index = np.argmax(defect_prediction)
            print(f"Defect index: {defect_index}", file=sys.stderr)
            
            defect_classes = ['Burn Through', 'Contamination', 'Lack of Fusion', 
                            'Lack of penetration', 'Misalignment']
            defect_type = defect_classes[defect_index]
            print(f"Defect type: {defect_type}", file=sys.stderr)
            print(f"Defect confidence: {float(defect_prediction[0][defect_index])}", file=sys.stderr)
            
            # Add defect information to result
            analysis_result["defect_type"] = defect_type
            analysis_result["defect_confidence"] = float(defect_prediction[0][defect_index])
            
            # Suggest a course of action based on the defect type
            if defect_type == 'Burn Through':
                analysis_result["message"] = ('Caution: Bad Weld. \nThe specific defect type is Burn Through.\nCauses:'
                    '\n1) Excessive root gap\n2) Excessive weld current\n3) Insufficient root face\n\n'
                    'Remedies:\n1) Keeping proper root gap.\n2) Controlling the weld current.\n'
                    '3) Can be repaired by removing the hole and re-weld and then PWHT')
            
            elif defect_type == 'Contamination':
                analysis_result["message"] = ('Caution: Bad Weld. \nThe specific defect type is Contamination.\nCauses:'
                    '\n1) The electrode is not well coated / Corroded Electrode\n'
                    '2) Presence of oil, grease, hydrocarbon, water, or rust on the weld surface.\n'
                    '3) Use of incorrect shielding gas or improper shielding or air entrapment.\n'
                    '4) Too high gas flow/ Too great arc voltage\n'
                    '5) Gas evolution due to improper surface treatment.\n\nRemedies:'
                    '\n1) Clean the weld surface and materials\n'
                    '2) Use dry, good-quality electrodes.\n'
                    '3) Optimize the welding process to allow gases to escape.\n'
                    '4) The gas flow meter is to be configured with the correct flow settings.')
            
            elif defect_type == 'Lack of Fusion':
                analysis_result["message"] = ('Caution: Bad Weld. \nThe specific defect type is Lack of Fusion.\nCauses:'
                    '\n1) Low heat input/Low Arc current\n'
                    '2) Wrong electrode diameter with respect to the material thickness.\n'
                    '3) High travel speed.\n4) Large Weld Pool.\n5) Improper bead placement.\n6) Oxide or Scale in weld preparation.\n'
                    '7) Large Root Face/Small root gap/Excessive root misalignment\n\nRemedies:'
                    '\n1) Reduce travel speed.\n'
                    '2) Appropriate bead positioning.\n3) Maintaining Correct root gaps.\n'
                    '4) Increase current or heat input.\n5) Improve edge preparation.')
            
            elif defect_type == 'Lack of penetration':
                analysis_result["message"] = ('Caution: Bad Weld. \nThe specific defect type is Lack of penetration.\nCause:'
                    '\n1) Excessive thick root face.\n'
                    '2) Root gap is too small\n3) Fast travel speed\n4) Use of vertically down welding\n5) Low heat input\n6) Too large electrode\n\n'
                    'Remedies:\n1) Reduce Electrode Size\n2) Proper joint preparation i.e. providing a suitable root gap.\n'
                    '3) Proper heat input\n4) Correct travel speed\n5) Vertical up procedure')
            
            elif defect_type == 'Misalignment':
                analysis_result["message"] = 'Caution: Bad Weld. \nThe specific defect type is Misalignment. Align the weldment properly'
            
            else:
                analysis_result["message"] = 'Unknown defect type.'
        else:
            print("Good weld detected, no defect classification needed", file=sys.stderr)
            analysis_result["message"] = 'The weld is good. No further action required.'
        
        print("Analysis completed successfully", file=sys.stderr)
        return analysis_result
        
    except Exception as e:
        print(f"Error analyzing image: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        return {"error": f"Error analyzing image: {str(e)}"}

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Analyze weld quality in an image')
    parser.add_argument('image_path', nargs='?', help='Path to the image file to analyze')
    parser.add_argument('--api-mode', action='store_true', help='Run in API mode (output JSON)')
    args = parser.parse_args()
    
    # If no image path is provided and not in API mode, use GUI to select an image
    if not args.image_path and not args.api_mode:
        # Create root window and hide it
        root = tk.Tk()
        root.withdraw()
        
        # Prompt the user to select an image file
        file_path = filedialog.askopenfilename(
            title="Select an Image",
            filetypes=[("Image Files", "*.jpg *.png *.jpeg *.tif")]
        )
        
        if not file_path:
            print('No image selected. Exiting the program.')
            root.destroy()
            return
        
        # Analyze the image
        result = analyze_image(file_path)
        
        # Display the result in a popup message
        if "error" in result:
            messagebox.showerror("Error", result["error"])
        else:
            messagebox.showinfo('Decision Support Window', result["message"])
        
        # Destroy the root window
        root.destroy()
    
    # If image path is provided or in API mode
    elif args.image_path:
        # Analyze the image
        result = analyze_image(args.image_path)
        
        # Output the result
        if args.api_mode:
            # In API mode, output JSON
            try:
                json_result = json.dumps(result)
                print(json_result)
                sys.stdout.flush()
            except Exception as e:
                print(json.dumps({"error": f"Failed to serialize result: {str(e)}"}))
                sys.stdout.flush()
        else:
            # In normal mode, create a simple GUI to display the result
            root = tk.Tk()
            root.withdraw()
            
            if "error" in result:
                messagebox.showerror("Error", result["error"])
            else:
                messagebox.showinfo('Decision Support Window', result["message"])
            
            root.destroy()
    else:
        print("Error: No image path provided")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        if '--api-mode' in sys.argv:
            print(json.dumps({"error": f"Unhandled exception: {str(e)}"}))
        else:
            print(f"Error: {str(e)}")
        sys.exit(1)