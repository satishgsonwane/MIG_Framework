import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs'; // Import sync fs functions
import * as path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    // Get the image path from the request
    const { imagePath } = await request.json();

    if (!imagePath) {
      return NextResponse.json(
        { error: 'No image path provided' },
        { status: 400 }
      );
    }

    // Create the edge detection results directory if it doesn't exist
    const edgeDetectionDir = join(process.cwd(), 'public', 'edge_detection_results');
    try {
      await fs.mkdir(edgeDetectionDir, { recursive: true });
    } catch (error) {
      console.log('Edge detection directory already exists or could not be created');
    }

    // Get the absolute path to the image
    const absoluteImagePath = join(process.cwd(), 'public', imagePath.replace(/^\//, ''));
    
    // Get the path to the Fit_curve.py script
    const scriptPath = join(process.cwd(), 'public', 'Fit_curve.py');

    // Determine the command to run the script
    const command = `python "${scriptPath}" "${absoluteImagePath}" "${edgeDetectionDir}"`;
    
    console.log(`Running command: ${command}`);

    // Execute the command
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error(`Error running edge detection: ${stderr}`);
    }
    
    console.log(`Edge detection output: ${stdout}`);

    // Get the output file path from the stdout or construct it
    const outputFileName = `${imagePath.split('/').pop().split('.')[0]}_edge_detection.jpg`;
    const outputPath = `/edge_detection_results/${outputFileName}`;

    return NextResponse.json({
      success: true,
      edgeDetectionImagePath: outputPath
    });
  } catch (error: any) {
    console.error('Error in edge detection API:', error);
    return NextResponse.json(
      { error: 'Failed to run edge detection', details: error.message },
      { status: 500 }
    );
  }
} 