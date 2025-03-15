import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// Add a GET handler for testing
export async function GET() {
  return NextResponse.json({ message: 'Edge and LOWESS API is working' });
}

export async function POST(request: NextRequest) {
  try {
    // Get the input image path from the request
    const { imagePath } = await request.json();
    
    if (!imagePath) {
      return NextResponse.json(
        { error: 'Input image path is required' },
        { status: 400 }
      );
    }
    
    // Fix path handling - remove 'public/' prefix if it exists
    const normalizedImagePath = imagePath.startsWith('public/') 
      ? imagePath.substring(7) // Remove 'public/' prefix
      : imagePath;
    
    // Ensure the input image exists
    const absoluteImagePath = join(process.cwd(), 'public', normalizedImagePath);
    console.log('Absolute image path:', absoluteImagePath);
    
    if (!fs.existsSync(absoluteImagePath)) {
      return NextResponse.json(
        { error: `Input image not found at path: ${absoluteImagePath}` },
        { status: 404 }
      );
    }
    
    // Define the output directory
    const outputDir = join(process.cwd(), 'public');
    
    // Build the command to run the combined edge detection and LOWESS analysis
    const pythonScript = join(process.cwd(), 'public', 'edge_and_lowess.py');
    const command = `python "${pythonScript}" "${absoluteImagePath}" --output_dir "${outputDir}"`;
    
    console.log(`Running command: ${command}`);
    
    // Execute the command
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error(`Processing error: ${stderr}`);
    }
    
    console.log(`Processing output: ${stdout}`);
    
    // Get the base name of the input image to find the output files
    const imageBaseName = normalizedImagePath.split('/').pop()?.split('.')[0] || 'output';
    
    // Construct paths to the output files
    const edgeDetectionPath = `/edge_detection_results/${imageBaseName}_edge_detection.png`;
    const edgeOverlayPath = `/edge_detection_results/${imageBaseName}_edge_overlay.png`;
    const lowessVisualizationPath = `/lowess_results/${imageBaseName}_lowess_visualization.png`;
    const lowessFitPath = `/lowess_results/${imageBaseName}_weld_seam_lowess_fit.png`;
    
    // Check if the output files exist
    const absoluteEdgeDetectionPath = join(process.cwd(), 'public', edgeDetectionPath);
    const absoluteEdgeOverlayPath = join(process.cwd(), 'public', edgeOverlayPath);
    const absoluteLowessVisPath = join(process.cwd(), 'public', lowessVisualizationPath);
    const absoluteLowessFitPath = join(process.cwd(), 'public', lowessFitPath);
    
    console.log('Checking for output files:');
    console.log('- Edge detection:', absoluteEdgeDetectionPath, fs.existsSync(absoluteEdgeDetectionPath));
    console.log('- LOWESS visualization:', absoluteLowessVisPath, fs.existsSync(absoluteLowessVisPath));
    
    if (!fs.existsSync(absoluteEdgeDetectionPath) || 
        !fs.existsSync(absoluteLowessVisPath)) {
      return NextResponse.json(
        { error: 'Processing failed to generate output files' },
        { status: 500 }
      );
    }
    
    // Return the paths to the output files
    return NextResponse.json({
      success: true,
      edgeDetectionPath,
      edgeOverlayPath,
      lowessVisualizationPath,
      lowessFitPath
    });
    
  } catch (error: any) {
    console.error('Error processing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process image' },
      { status: 500 }
    );
  }
} 