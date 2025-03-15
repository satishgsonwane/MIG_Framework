import os
import numpy as np
import tkinter as tk
from tkinter import filedialog
from tkinter import messagebox
import cv2
import argparse
import json
import sys
import traceback

try:
    import matlab.engine
    MATLAB_AVAILABLE = True
except ImportError:
    MATLAB_AVAILABLE = False
    print("MATLAB Engine for Python not available. Install it using MATLAB's setup.", file=sys.stderr)

def analyze_image_with_matlab(image_path):
    """
    Analyze a weld image using MATLAB Engine for Python
    This uses the original MATLAB models directly
    """
    try:
        if not MATLAB_AVAILABLE:
            return {"error": "MATLAB Engine for Python not available. Install it using MATLAB's setup."}
        
        print("Starting MATLAB Engine...", file=sys.stderr)
        eng = matlab.engine.start_matlab()
        
        # Ensure the current directory has the .mat files
        current_dir = os.getcwd()
        eng.cd(current_dir)
        
        # Load the models
        print("Loading models in MATLAB...", file=sys.stderr)
        eng.eval("load('net2.mat')", nargout=0)
        eng.eval("load('net5.mat')", nargout=0)
        
        # Check if models are loaded properly (avoid using whos directly)
        # Instead, check if specific variables exist
        try:
            # Try different possible variable names for the networks
            net2_exists = eng.eval("exist('net2', 'var')", nargout=1)
            net5_exists = eng.eval("exist('net5', 'var')", nargout=1)
            net_exists = eng.eval("exist('net', 'var')", nargout=1)
            
            print(f"net2 exists: {bool(net2_exists)}", file=sys.stderr)
            print(f"net5 exists: {bool(net5_exists)}", file=sys.stderr)
            print(f"net exists: {bool(net_exists)}", file=sys.stderr)
            
            # If the variables don't exist with expected names, try to find what's there
            if not (net2_exists and net5_exists):
                # Try to get variable names without using whos
                eng.eval("vars = who;", nargout=0)
                # Get the first variable name (safer than whos)
                first_var = eng.eval("vars{1}", nargout=1)
                print(f"First variable in workspace: {first_var}", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Could not check model variables: {e}", file=sys.stderr)
        
        # Read and preprocess the image in MATLAB
        print(f"Processing image: {image_path}", file=sys.stderr)
        
        # Convert backslashes to forward slashes for MATLAB
        matlab_image_path = image_path.replace('\\', '/')
        
        # Execute MATLAB commands one by one to better isolate issues
        try:
            eng.eval(f"image = imread('{matlab_image_path}');", nargout=0)
            print("Image loaded successfully in MATLAB", file=sys.stderr)
        except Exception as e:
            print(f"Error reading image in MATLAB: {e}", file=sys.stderr)
            return {"error": f"Failed to read image in MATLAB: {str(e)}"}
        
        try:
            eng.eval("resizedImage = imresize(image, [100, 100]);", nargout=0)
            print("Image resized successfully in MATLAB", file=sys.stderr)
        except Exception as e:
            print(f"Error resizing image in MATLAB: {e}", file=sys.stderr)
            return {"error": f"Failed to resize image in MATLAB: {str(e)}"}
        
        try:
            eng.eval("if size(resizedImage, 3) > 1, resizedImage = im2gray(resizedImage); end", nargout=0)
            print("Image converted to grayscale in MATLAB", file=sys.stderr)
        except Exception as e:
            print(f"Error converting image to grayscale in MATLAB: {e}", file=sys.stderr)
            return {"error": f"Failed to convert image to grayscale in MATLAB: {str(e)}"}
        
        # Classify the image using net2
        classification = ""
        try:
            # Try with net2 first
            if net2_exists:
                classification = eng.eval("string(classify(net2, resizedImage))", nargout=1)
                print(f"Classification with net2: {classification}", file=sys.stderr)
            else:
                # If net2 doesn't exist, try with the first variable (which should be the network)
                var_name = eng.eval("vars{1}", nargout=1)
                classification = eng.eval(f"string(classify({var_name}, resizedImage))", nargout=1)
                print(f"Classification with {var_name}: {classification}", file=sys.stderr)
        except Exception as e:
            print(f"Error classifying with net2: {e}", file=sys.stderr)
            return {"error": f"Failed to classify image with net2: {str(e)}"}
        
        # Initialize result dictionary
        analysis_result = {
            "classification": classification,
            "confidence": 0.0  # MATLAB's classify doesn't return confidence by default
        }
        
        if "Bad Weld" in classification:
            # Classify the defect type using net5
            defect_type = ""
            try:
                # Try with net5 first
                if net5_exists:
                    defect_type = eng.eval("string(classify(net5, resizedImage))", nargout=1)
                elif net_exists:
                    defect_type = eng.eval("string(classify(net, resizedImage))", nargout=1)
                else:
                    # Try with the second variable if there is one
                    eng.eval("if length(vars) > 1, second_var = vars{2}; else second_var = vars{1}; end", nargout=0)
                    var_name = eng.eval("second_var", nargout=1)
                    defect_type = eng.eval(f"string(classify({var_name}, resizedImage))", nargout=1)
                
                print(f"Defect type: {defect_type}", file=sys.stderr)
            except Exception as e:
                print(f"Error classifying defect: {e}", file=sys.stderr)
                return {"error": f"Failed to classify defect: {str(e)}"}
            
            # Add defect information to result
            analysis_result["defect_type"] = defect_type
            
            # Set message based on defect type
            if "Burn Through" in defect_type:
                analysis_result["message"] = ('Caution: Bad Weld. \nThe specific defect type is Burn Through.\nCauses:'
                    '\n1) Excessive root gap\n2) Excessive weld current\n3) Insufficient root face\n\n'
                    'Remedies:\n1) Keeping proper root gap.\n2) Controlling the weld current.\n'
                    '3) Can be repaired by removing the hole and re-weld and then PWHT')
            
            elif "Contamination" in defect_type:
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
            
            elif "Lack of Fusion" in defect_type:
                analysis_result["message"] = ('Caution: Bad Weld. \nThe specific defect type is Lack of Fusion.\nCauses:'
                    '\n1) Low heat input/Low Arc current\n'
                    '2) Wrong electrode diameter with respect to the material thickness.\n'
                    '3) High travel speed.\n4) Large Weld Pool.\n5) Improper bead placement.\n6) Oxide or Scale in weld preparation.\n'
                    '7) Large Root Face/Small root gap/Excessive root misalignment\n\nRemedies:'
                    '\n1) Reduce travel speed.\n'
                    '2) Appropriate bead positioning.\n3) Maintaining Correct root gaps.\n'
                    '4) Increase current or heat input.\n5) Improve edge preparation.')
            
            elif "Lack of penetration" in defect_type:
                analysis_result["message"] = ('Caution: Bad Weld. \nThe specific defect type is Lack of penetration.\nCause:'
                    '\n1) Excessive thick root face.\n'
                    '2) Root gap is too small\n3) Fast travel speed\n4) Use of vertically down welding\n5) Low heat input\n6) Too large electrode\n\n'
                    'Remedies:\n1) Reduce Electrode Size\n2) Proper joint preparation i.e. providing a suitable root gap.\n'
                    '3) Proper heat input\n4) Correct travel speed\n5) Vertical up procedure')
            
            elif "Misalignment" in defect_type:
                analysis_result["message"] = 'Caution: Bad Weld. \nThe specific defect type is Misalignment. Align the weldment properly'
            
            else:
                analysis_result["message"] = 'Unknown defect type.'
        else:
            analysis_result["message"] = 'The weld is good. No further action required.'
        
        # Close MATLAB engine
        eng.quit()
        
        return analysis_result
        
    except Exception as e:
        print(f"Error analyzing image: {str(e)}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        
        # Make sure to close MATLAB engine in case of error
        try:
            if 'eng' in locals():
                eng.quit()
        except:
            pass
            
        return {"error": f"Error analyzing image: {str(e)}"}

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Analyze weld quality in an image using MATLAB Engine')
    parser.add_argument('image_path', nargs='?', help='Path to the image file to analyze')
    parser.add_argument('--api-mode', action='store_true', help='Run in API mode (output JSON)')
    args = parser.parse_args()
    
    # Check if MATLAB Engine is available
    if not MATLAB_AVAILABLE:
        print("MATLAB Engine for Python is not available.")
        print("To install it, run the following command in MATLAB:")
        print("cd (fullfile(matlabroot,'extern','engines','python'))")
        print("system('python setup.py install')")
        return
    
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
        result = analyze_image_with_matlab(file_path)
        
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
        result = analyze_image_with_matlab(args.image_path)
        
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