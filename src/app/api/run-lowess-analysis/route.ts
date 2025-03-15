import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    // Get the edge detection image path from the request
    const { edgeDetectionImagePath } = await request.json();
    
    if (!edgeDetectionImagePath) {
      return NextResponse.json(
        { error: 'Edge detection image path is required' },
        { status: 400 }
      );
    }
    
    // Ensure the edge detection image exists
    const absoluteEdgeImagePath = join(process.cwd(), edgeDetectionImagePath);
    if (!fs.existsSync(absoluteEdgeImagePath)) {
      return NextResponse.json(
        { error: 'Edge detection image not found' },
        { status: 404 }
      );
    }
    
    // Define the output directory for LOWESS results
    const outputDir = join(process.cwd(), 'public', 'lowess_results');
    
    // Ensure the output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Build the command to run the LOWESS analysis
    const pythonScript = join(process.cwd(), 'public', 'fit_lowess.py');
    const command = `python "${pythonScript}" "${absoluteEdgeImagePath}" --output_dir "${outputDir}"`;
    
    console.log(`Running command: ${command}`);
    
    // Execute the command
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error(`LOWESS analysis error: ${stderr}`);
    }
    
    console.log(`LOWESS analysis output: ${stdout}`);
    
    // Get the base name of the edge detection image to find the output files
    const edgeImageBaseName = edgeDetectionImagePath.split('/').pop()?.split('.')[0] || 'output';
    
    // Construct paths to the output files
    const lowessVisualizationPath = `/lowess_results/${edgeImageBaseName}_lowess_visualization.png`;
    const lowessFitPath = `/lowess_results/${edgeImageBaseName}_weld_seam_lowess_fit.png`;
    
    // Check if the output files exist
    const absoluteLowessVisPath = join(process.cwd(), 'public', lowessVisualizationPath);
    const absoluteLowessFitPath = join(process.cwd(), 'public', lowessFitPath);
    
    if (!fs.existsSync(absoluteLowessVisPath) || !fs.existsSync(absoluteLowessFitPath)) {
      return NextResponse.json(
        { error: 'LOWESS analysis failed to generate output files' },
        { status: 500 }
      );
    }
    
    // Return the paths to the output files
    return NextResponse.json({
      success: true,
      lowessVisualizationPath,
      lowessFitPath
    });
    
  } catch (error: any) {
    console.error('Error running LOWESS analysis:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run LOWESS analysis' },
      { status: 500 }
    );
  }
} 