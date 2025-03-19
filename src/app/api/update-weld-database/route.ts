import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

// Define TypeScript interfaces
interface ParameterSet {
  wireDiameter: string;
  current: string;
  voltage: string;
  wireFeedSpeed: string;
  speed: string;
  gasFlow: string;
  [key: string]: string;
}

interface MaterialThicknessMap {
  [thickness: string]: ParameterSet;
}

interface WeldDatabase {
  [material: string]: MaterialThicknessMap;
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    // Validate incoming data
    if (!data.material || !data.plateThickness) {
      return NextResponse.json({ 
        success: false, 
        error: 'Material and plate thickness are required' 
      }, { status: 400 });
    }
    
    // Required parameter fields
    const requiredParams = [
      'wireDiameter', 
      'current', 
      'voltage', 
      'wireFeedSpeed', 
      'speed', 
      'gasFlow'
    ];
    
    // Check if all required parameters are present
    for (const param of requiredParams) {
      if (!data[param]) {
        return NextResponse.json({ 
          success: false, 
          error: `Parameter ${param} is required` 
        }, { status: 400 });
      }
    }
    
    // Path to the JSON file
    const filePath = path.join(process.cwd(), 'public', 'weld-parameters.json');
    
    // Read the existing database
    let weldDatabase: WeldDatabase = {};
    try {
      const fileContent = await fsPromises.readFile(filePath, 'utf8');
      weldDatabase = JSON.parse(fileContent) as WeldDatabase;
    } catch (error) {
      // If file doesn't exist or is invalid, create a new database
      weldDatabase = {};
    }
    
    // Extract the parameters we want to save
    const { material, plateThickness } = data;
    const parameters = requiredParams.reduce((acc, param) => {
      acc[param] = data[param];
      return acc;
    }, {} as ParameterSet);
    
    // Update the database
    if (!weldDatabase[material]) {
      weldDatabase[material] = {};
    }
    
    weldDatabase[material][plateThickness] = parameters;
    
    // Write the updated database back to file
    await fsPromises.writeFile(filePath, JSON.stringify(weldDatabase, null, 2), 'utf8');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Weld parameters database updated successfully' 
    });
    
  } catch (error) {
    console.error('Error updating weld parameters database:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to update weld parameters database' 
    }, { status: 500 });
  }
} 