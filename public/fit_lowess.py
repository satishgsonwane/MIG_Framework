import cv2
import numpy as np
from scipy.interpolate import UnivariateSpline
import matplotlib.pyplot as plt
import csv
import os
import sys
from statsmodels.nonparametric.smoothers_lowess import lowess
import pandas as pd
import argparse

def run_lowess_analysis(input_img, output_dir=None):
    """
    Run LOWESS analysis on an edge-detected image
    
    Args:
        input_img: Path to the input image (edge detection result)
        output_dir: Directory to save output files (defaults to same directory as input)
    
    Returns:
        dict: Paths to the generated files
    """
    # Set output directory
    if output_dir is None:
        output_dir = os.path.dirname(input_img)
    
    # Create output directory if it doesn't exist
    os.makedirs(output_dir, exist_ok=True)
    
    # Get base name for output files
    base_name = os.path.splitext(os.path.basename(input_img))[0]
    
    # Read the image
    img = cv2.imread(input_img, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Could not read image: {input_img}")
    
    # Resize the image to 1280x720
    img = cv2.resize(img, (1280, 720))
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply GaussianBlur to reduce noise and improve edge detection
    gk = 9  # Gaussian kernel size
    blurred = cv2.GaussianBlur(gray, (gk, gk), 0)
    
    # Apply threshold to get binary image from edge detection result
    _, binary = cv2.threshold(blurred, 127, 255, cv2.THRESH_BINARY)
    
    # Find contours in the binary image
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
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
    plt.figure(figsize=(12.8, 7.2))  # 1280x720 pixels at 100 dpi
    
    # Plot the original curve and the fitted polynomial curve
    plt.scatter(x_sorted, y_sorted, label='Original Curve')
    plt.plot(x_fit, y_fit, 'r-', label=f'Fitted Polynomial Degree {degree}')
    
    # Invert the y-axis to correct the flipped image
    plt.gca().invert_yaxis()
    
    # Set the aspect ratio to 'equal' to preserve the image proportions
    plt.gca().set_aspect('equal', adjustable='box')
    
    # Add labels and title
    plt.xlabel('X coordinate')
    plt.ylabel('Y coordinate')
    plt.title('Weld Seam Curve Fitting')
    
    plt.legend()
    
    # Save the polynomial fit figure
    poly_fit_path = os.path.join(output_dir, f'{base_name}_weld_seam_analysis.png')
    plt.savefig(poly_fit_path, dpi=100, bbox_inches='tight')
    plt.close()
    
    # Output the fitted curve coordinates to a CSV file
    fitted_csv_path = os.path.join(output_dir, f'{base_name}_fitted_curve_coordinates.csv')
    with open(fitted_csv_path, 'w', newline='') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(['X', 'Y'])  # Write header
        for x, y in zip(x_fit, y_fit):
            csvwriter.writerow([x, y])
    
    original_csv_path = os.path.join(output_dir, f'{base_name}_original_curve_coordinates.csv')
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
    plt.figure(figsize=(12, 8))
    plt.scatter(x_sorted, y_sorted, color='blue', s=10, label='Original Data', alpha=0.5)
    plt.plot(x_smoothed, y_smoothed, color='red', label='LOWESS Smoothed')
    
    # Invert the y-axis
    plt.gca().invert_yaxis()
    
    # Set the aspect ratio to 'equal'
    plt.gca().set_aspect('equal', adjustable='box')
    
    plt.xlabel('X coordinate')
    plt.ylabel('Y coordinate')
    plt.title('LOWESS Smoothing of Weld Seam Data')
    plt.legend()
    
    # Save the LOWESS figure
    lowess_fit_path = os.path.join(output_dir, f'{base_name}_weld_seam_lowess_fit.png')
    plt.savefig(lowess_fit_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    # Save the LOWESS coordinates to a new CSV file
    lowess_csv_path = os.path.join(output_dir, f'{base_name}_lowess_smoothed_coordinates.csv')
    with open(lowess_csv_path, 'w', newline='') as csvfile:
        csvwriter = csv.writer(csvfile)
        csvwriter.writerow(['X', 'Y'])  # Write header
        for x, y in zip(x_smoothed, y_smoothed):
            csvwriter.writerow([x, y])
    
    # Create a visualization image with the original image and LOWESS curve
    result_img = img.copy()
    
    # Draw the LOWESS curve on the image
    points = np.column_stack((x_smoothed, y_smoothed)).astype(np.int32)
    cv2.polylines(result_img, [points], False, (0, 255, 0), 2)
    
    # Save the visualization
    vis_path = os.path.join(output_dir, f'{base_name}_lowess_visualization.png')
    cv2.imwrite(vis_path, result_img)
    
    return {
        'lowess_fit_path': lowess_fit_path,
        'lowess_csv_path': lowess_csv_path,
        'visualization_path': vis_path,
        'polynomial_fit_path': poly_fit_path
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Run LOWESS analysis on an edge-detected image')
    parser.add_argument('input_img', help='Path to the input image (edge detection result)')
    parser.add_argument('--output_dir', help='Directory to save output files')
    
    args = parser.parse_args()
    
    try:
        result = run_lowess_analysis(args.input_img, args.output_dir)
        print(f"LOWESS analysis completed successfully.")
        print(f"LOWESS fit saved to: {result['lowess_fit_path']}")
        print(f"Visualization saved to: {result['visualization_path']}")
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)
