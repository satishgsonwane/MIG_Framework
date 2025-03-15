import cv2
import numpy as np
import matplotlib.pyplot as plt
import os
import sys
import csv
import argparse
from statsmodels.nonparametric.smoothers_lowess import lowess

# Set consistent figure sizes and DPI for better UI display
FIGURE_WIDTH = 12.8  # inches
FIGURE_HEIGHT = 7.2  # inches
FIGURE_DPI = 100     # dots per inch

# Set consistent image dimensions
IMAGE_WIDTH = 1280
IMAGE_HEIGHT = 720

def process_image_with_edge_and_lowess(input_img, output_dir=None):
    """
    Process an image with edge detection and LOWESS analysis
    
    Args:
        input_img: Path to the input image
        output_dir: Directory to save output files (defaults to same directory as input)
    
    Returns:
        dict: Paths to the generated files
    """
    # Set output directory
    if output_dir is None:
        output_dir = os.path.dirname(input_img)
    
    # Create output directories if they don't exist
    edge_dir = os.path.join(output_dir, 'edge_detection_results')
    lowess_dir = os.path.join(output_dir, 'lowess_results')
    os.makedirs(edge_dir, exist_ok=True)
    os.makedirs(lowess_dir, exist_ok=True)
    
    # Get base name for output files
    base_name = os.path.splitext(os.path.basename(input_img))[0]
    
    # Read the image
    img = cv2.imread(input_img, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not read image: {input_img}")
    
    # Resize the image to consistent dimensions
    img = cv2.resize(img, (IMAGE_WIDTH, IMAGE_HEIGHT))
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply GaussianBlur to reduce noise and improve edge detection
    gk = 9  # Gaussian kernel size
    blurred = cv2.GaussianBlur(gray, (gk, gk), 0)
    
    # Apply Canny edge detection
    cl = 50  # Lower threshold
    cu = 210  # Upper threshold
    aps = 3   # Aperture size
    edges = cv2.Canny(blurred, cl, cu, apertureSize=aps)
    
    # Create a colored edge overlay for visualization
    edge_overlay = img.copy()
    # Use bright red for better visibility
    edge_overlay[edges > 0] = [0, 0, 255]  # Red color for edges
    
    # Add a border to the edge detection result for better visibility
    edges_colored = cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)
    # Add a white background for better visibility of the black and white edge image
    white_bg = np.ones_like(edges_colored) * 255
    edges_with_bg = cv2.addWeighted(edges_colored, 1, white_bg, 0.1, 0)
    
    # Save the edge detection result
    edge_result_path = os.path.join(edge_dir, f'{base_name}_edge_detection.png')
    cv2.imwrite(edge_result_path, edges_with_bg)
    
    # Save the edge overlay
    edge_overlay_path = os.path.join(edge_dir, f'{base_name}_edge_overlay.png')
    cv2.imwrite(edge_overlay_path, edge_overlay)
    
    # Find contours in the edged image
    contours, hierarchy = cv2.findContours(edges.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        raise ValueError("No contours found in the image")
    
    # Find the largest contour which should correspond to the curved line
    largest_contour = max(contours, key=cv2.contourArea)
    
    # Extract the x and y coordinates of the points of the contour
    x = largest_contour[:, 0, 0]
    y = largest_contour[:, 0, 1]
    
    # Sort the points by x coordinates (important for polynomial fitting)
    sorted_indices = np.argsort(x)
    x_sorted = x[sorted_indices]
    y_sorted = y[sorted_indices]
    
    # Choose the degree of the polynomial you want to fit
    degree = 5  # for example, a 5th degree polynomial
    
    # Fit the polynomial to the curve
    coefficients = np.polyfit(x_sorted, y_sorted, degree)
    
    # Create a polynomial function from the coefficients
    poly_function = np.poly1d(coefficients)
    
    # Generate a smooth x range to plot the fitted polynomial curve
    x_fit = np.linspace(min(x_sorted), max(x_sorted), 500)
    y_fit = poly_function(x_fit)
    
    # Create a new figure with the correct size
    plt.figure(figsize=(FIGURE_WIDTH, FIGURE_HEIGHT))
    
    # Set a white background with a light grid - using a more compatible style
    try:
        # Try to use ggplot style which is widely available
        plt.style.use('ggplot')
    except:
        # If that fails, set basic grid properties manually
        plt.rcParams['axes.grid'] = True
        plt.rcParams['grid.linestyle'] = ':'
        plt.rcParams['grid.color'] = '#cccccc'
        plt.rcParams['axes.facecolor'] = '#f5f5f5'
    
    # Plot the original curve and the fitted polynomial curve
    plt.scatter(x_sorted, y_sorted, label='Original Curve', alpha=0.5, s=10, color='blue')
    plt.plot(x_fit, y_fit, 'r-', label=f'Fitted Polynomial Degree {degree}', linewidth=2)
    
    # Invert the y-axis to correct the flipped image
    plt.gca().invert_yaxis()
    
    # Set the aspect ratio to 'equal' to preserve the image proportions
    plt.gca().set_aspect('equal', adjustable='box')
    
    # Add labels and title
    plt.xlabel('X coordinate')
    plt.ylabel('Y coordinate')
    plt.title('Weld Seam Curve Fitting', fontsize=14, fontweight='bold')
    
    plt.legend()
    
    # Save the polynomial fit figure
    poly_fit_path = os.path.join(lowess_dir, f'{base_name}_weld_seam_analysis.png')
    plt.savefig(poly_fit_path, dpi=FIGURE_DPI, bbox_inches='tight')
    plt.close()
    
    # Output the fitted curve coordinates to a CSV file
    fitted_csv_path = os.path.join(lowess_dir, f'{base_name}_fitted_curve_coordinates.csv')
    with open(fitted_csv_path, 'w', newline='') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(['X', 'Y'])  # Write header
        for x, y in zip(x_fit, y_fit):
            csvwriter.writerow([x, y])
    
    original_csv_path = os.path.join(lowess_dir, f'{base_name}_original_curve_coordinates.csv')
    with open(original_csv_path, 'w', newline='') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(['X', 'Y'])  # Write header
        for x, y in zip(x_sorted, y_sorted):
            csvwriter.writerow([x, y])
    
    # Perform LOWESS smoothing
    frac = 1/50  # Decrease for more local fit, increase for smoother fit
    it = 10  # Number of iterations (increase for more robustness to outliers)
    delta = 0.0  # For speeding up calculation (can be increased if needed)
    
    smoothed = lowess(y_sorted, x_sorted, frac=frac, it=it, delta=delta)
    
    # Extract smoothed x and y values
    x_smoothed = smoothed[:, 0]
    y_smoothed = smoothed[:, 1]
    
    # Create the LOWESS plot
    plt.figure(figsize=(FIGURE_WIDTH, FIGURE_HEIGHT))
    
    # Set a white background with a light grid - using a more compatible style
    try:
        # Try to use ggplot style which is widely available
        plt.style.use('ggplot')
    except:
        # If that fails, set basic grid properties manually
        plt.rcParams['axes.grid'] = True
        plt.rcParams['grid.linestyle'] = ':'
        plt.rcParams['grid.color'] = '#cccccc'
        plt.rcParams['axes.facecolor'] = '#f5f5f5'
    
    plt.scatter(x_sorted, y_sorted, color='blue', s=10, label='Original Data', alpha=0.5)
    plt.plot(x_smoothed, y_smoothed, color='red', label='LOWESS Smoothed', linewidth=2)
    
    # Invert the y-axis
    plt.gca().invert_yaxis()
    
    # Set the aspect ratio to 'equal'
    plt.gca().set_aspect('equal', adjustable='box')
    
    plt.xlabel('X coordinate')
    plt.ylabel('Y coordinate')
    plt.title('LOWESS Smoothing of Weld Seam Data', fontsize=14, fontweight='bold')
    plt.legend()
    
    # Save the LOWESS figure
    lowess_fit_path = os.path.join(lowess_dir, f'{base_name}_weld_seam_lowess_fit.png')
    plt.savefig(lowess_fit_path, dpi=FIGURE_DPI, bbox_inches='tight')
    plt.close()
    
    # Save the LOWESS coordinates to a new CSV file
    lowess_csv_path = os.path.join(lowess_dir, f'{base_name}_lowess_smoothed_coordinates.csv')
    with open(lowess_csv_path, 'w', newline='') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(['X', 'Y'])  # Write header
        for x, y in zip(x_smoothed, y_smoothed):
            csvwriter.writerow([x, y])
    
    # Create a visualization image with the original image and LOWESS curve
    result_img = img.copy()
    
    # Draw the LOWESS curve on the image with a thicker, more visible line
    points = np.column_stack((x_smoothed, y_smoothed)).astype(np.int32)
    cv2.polylines(result_img, [points], False, (0, 255, 0), 3)  # Thicker green line
    
    # Add a label to the image
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(result_img, 'LOWESS Curve', (10, 30), font, 1, (0, 255, 0), 2, cv2.LINE_AA)
    
    # Save the visualization
    vis_path = os.path.join(lowess_dir, f'{base_name}_lowess_visualization.png')
    cv2.imwrite(vis_path, result_img)
    
    # Return paths to all generated files
    return {
        'edge_detection_path': edge_result_path,
        'edge_overlay_path': edge_overlay_path,
        'lowess_fit_path': lowess_fit_path,
        'lowess_visualization_path': vis_path,
        'polynomial_fit_path': poly_fit_path
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Process an image with edge detection and LOWESS analysis')
    parser.add_argument('input_img', help='Path to the input image')
    parser.add_argument('--output_dir', help='Directory to save output files')
    
    args = parser.parse_args()
    
    try:
        result = process_image_with_edge_and_lowess(args.input_img, args.output_dir)
        print(f"Processing completed successfully.")
        print(f"Edge detection result saved to: {result['edge_detection_path']}")
        print(f"LOWESS visualization saved to: {result['lowess_visualization_path']}")
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1) 