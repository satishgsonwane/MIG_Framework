import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

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
    
    // Get absolute path to the image
    const absoluteImagePath = join(process.cwd(), 'public', imagePath.replace(/^\//, ''));
    
    // Get path to weld_prediction.py
    const scriptPath = join(process.cwd(), 'public', 'weld_prediction.py');
    
    // Get path to weld_env
    const envPath = join(process.cwd(), 'public', 'weld_env');
    
    // Determine the activation command based on OS
    const isWindows = process.platform === 'win32';
    const activateCmd = isWindows 
      ? `${envPath}\\Scripts\\activate.bat` 
      : `source ${envPath}/bin/activate`;
    
    // Build the command to run the prediction script
    const command = isWindows
      ? `call ${activateCmd} && python ${scriptPath} --image ${absoluteImagePath} --model ${join(process.cwd(), 'public', 'weld_classifier_model.pkl')}`
      : `${activateCmd} && python ${scriptPath} --image ${absoluteImagePath} --model ${join(process.cwd(), 'public', 'weld_classifier_model.pkl')}`;
    
    console.log('Executing command:', command);
    
    // Execute the command
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.error('Error from prediction script:', stderr);
    }
    
    console.log('Prediction output:', stdout);
    
    // Parse the output to extract the predicted class and confidence
    let predictedClass = '';
    let confidence = null;
    
    const classMatch = stdout.match(/Predicted class: (.+)/);
    if (classMatch && classMatch[1]) {
      predictedClass = classMatch[1].trim();
    }
    
    const confidenceMatch = stdout.match(/Confidence: ([0-9.]+)/);
    if (confidenceMatch && confidenceMatch[1]) {
      confidence = parseFloat(confidenceMatch[1]);
    }
    
    return NextResponse.json({
      success: true,
      predictedClass,
      confidence,
      output: stdout
    });
  } catch (error: any) {
    console.error('Error running weld prediction:', error);
    return NextResponse.json(
      { error: 'Failed to run weld prediction', details: error.message },
      { status: 500 }
    );
  }
} 