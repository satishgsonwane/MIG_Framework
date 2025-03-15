import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync } from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { imagePath } = await request.json();
    
    if (!imagePath) {
      return NextResponse.json(
        { error: 'No image path provided' },
        { status: 400 }
      );
    }
    
    // Construct the full path to the image
    const fullImagePath = join(process.cwd(), 'public', imagePath.startsWith('/') ? imagePath.substring(1) : imagePath);
    
    // Check if the image exists
    if (!existsSync(fullImagePath)) {
      return NextResponse.json(
        { error: `Image not found at path: ${fullImagePath}` },
        { status: 404 }
      );
    }
    
    console.log(`Running DSS analysis on image: ${fullImagePath}`);
    
    // Construct the command to run dss.py with the image path
    // We need to change directory to public where the ONNX models are located
    const command = `cd public && python dss.py "${fullImagePath}" --api-mode`;
    
    // Execute the command
    const { stdout, stderr } = await execAsync(command);
    
    // Log the output for debugging
    console.log('DSS Python stdout:', stdout);
    if (stderr) {
      console.log('DSS Python stderr:', stderr);
    }
    
    // Check if stderr contains actual errors or just warnings/info
    // NumPy often outputs warnings to stderr that aren't fatal
    const isNonFatalOutput = stderr.includes('UserWarning') || 
                            stderr.includes('Models loaded successfully') ||
                            stderr.includes('Expected input shape') ||
                            stderr.includes('Processed image shape');
    
    if (stderr && !isNonFatalOutput) {
      console.error('Error running dss.py:', stderr);
      return NextResponse.json(
        { error: 'Error running DSS analysis', details: stderr },
        { status: 500 }
      );
    }
    
    // If stdout is empty but stderr contains "Models loaded successfully", there might be an issue
    if (!stdout.trim() && stderr.includes('Models loaded successfully')) {
      console.error('DSS analysis produced no output:', stderr);
      return NextResponse.json(
        { error: 'DSS analysis produced no output', details: stderr },
        { status: 500 }
      );
    }
    
    // Parse the output to get the analysis result
    try {
      const result = JSON.parse(stdout);
      
      // Check if the result contains an error
      if (result.error) {
        console.error('DSS analysis returned an error:', result.error);
        return NextResponse.json({ 
          success: false, 
          error: result.error 
        });
      }
      
      // Return the successful result
      return NextResponse.json({ 
        success: true, 
        result 
      });
    } catch (e) {
      console.error('Failed to parse JSON output:', e);
      // If the output is not JSON, return it as a message
      return NextResponse.json({ 
        success: true, 
        result: {
          message: stdout.trim()
        }
      });
    }
  } catch (error: any) {
    console.error('Error in DSS analysis API:', error);
    return NextResponse.json(
      { error: 'Failed to run DSS analysis', details: error.message },
      { status: 500 }
    );
  }
} 