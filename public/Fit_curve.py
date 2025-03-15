import cv2
import numpy as np
import os
import sys
import re
from glob import glob

def resize_to_fit(image, window_width=800, window_height=600):
    """Resize the image to fit within the specified window size while maintaining aspect ratio."""
    h, w = image.shape[:2]
    scale = min(window_width / w, window_height / h)
    new_w = int(w * scale)
    new_h = int(h * scale)
    resized_image = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized_image, scale

def process_image(image_path, output_dir):
    """Process an image for edge detection with clear annotations."""
    # Read the image
    img = cv2.imread(image_path, cv2.IMREAD_COLOR)
    if img is None:
        print(f"Failed to read image: {image_path}")
        return None

    # Create a copy for drawing
    result_img = img.copy()
    
    # Convert to grayscale for edge detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply edge detection
    edges = detect_edges(gray)
    
    # Draw the edges on the image in red
    result_img[edges > 0] = [0, 0, 255]  # Red color for edges
    
    # Add annotations
    h, w = img.shape[:2]
    
    # Add a title at the top
    cv2.putText(result_img, "Edge Detection Result", (10, 30),
               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    
    # Add information about the image
    cv2.putText(result_img, f"Image: {os.path.basename(image_path)}", (10, h - 60),
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(result_img, f"Size: {w}x{h} pixels", (10, h - 30),
               cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    
    # Save the result
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    output_path = os.path.join(output_dir, f'{base_name}_edge_detection.jpg')
    cv2.imwrite(output_path, result_img)
    print(f"Edge detection completed for {image_path}")
    return [output_path]

def detect_edges(gray):
    """Detect edges in a grayscale image and return a binary edge map."""
    # Parameters for image processing
    gk = 11  # Gaussian kernel size
    cl = 90  # Canny lower threshold
    cu = 140 # Canny upper threshold
    ap = 3   # Aperture size
    
    # Apply GaussianBlur
    blurred = cv2.GaussianBlur(gray, (gk, gk), 0)
    
    # Apply Canny edge detector
    edges = cv2.Canny(blurred, cl, cu, apertureSize=ap)
    
    # Dilate the edges slightly to make them more visible
    kernel = np.ones((2, 2), np.uint8)
    edges = cv2.dilate(edges, kernel, iterations=1)
    
    return edges

def main():
    # Check command line arguments
    if len(sys.argv) < 3:
        print("Usage: python Fit_curve.py <input_image_path> <output_directory>")
        return
    
    input_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Check if input_path is a file or directory
    if os.path.isfile(input_path):
        # Process a single file
        process_image(input_path, output_dir)
    else:
        # Process all images in the directory
        input_dir = os.path.dirname(input_path) if os.path.isfile(input_path) else input_path
        image_extensions = ['*.png', '*.jpg', '*.jpeg', '*.bmp', '*.tiff', '*.gif', '*.JPG']
        image_files = []
        for ext in image_extensions:
            image_files.extend(glob(os.path.join(input_dir, ext)))
        
        # Process each image
        for image_file in image_files:
            process_image(image_file, output_dir)

    print("Processing complete.")

if __name__ == "__main__":
    main()
