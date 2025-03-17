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
    
    // Execute the Python script
    const command = `cd public && python dss.py "${fullImagePath}" --api-mode`;
    const { stdout, stderr } = await execAsync(command);
    
    // Log outputs for debugging
    if (stderr) {
      console.log('DSS analysis stderr (info):', stderr);
    }
    
    // Parse the JSON output
    try {
      const result = JSON.parse(stdout);
      
      // Check if result contains an actual error
      if (result.error && !result.classification) {
        return NextResponse.json({ 
          success: false, 
          error: result.error 
        });
      }
      
      // Return successful result
      return NextResponse.json({ 
        success: true, 
        result 
      });
      
    } catch (e) {
      console.error('Failed to parse JSON output:', e);
      return NextResponse.json({ 
        error: 'Failed to parse analysis results' 
      }, { status: 500 });
    }
    
  } catch (error: any) {
    console.error('Error in DSS analysis API:', error);
    return NextResponse.json(
      { error: 'Failed to run DSS analysis', details: error.message },
      { status: 500 }
    );
  }
} 