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

export async function GET(req: NextRequest) {
  try {
    // Path to the JSON file
    const filePath = path.join(process.cwd(), 'public', 'weld-parameters.json');
    
    // Read the existing database
    let weldDatabase: WeldDatabase = {};
    try {
      const fileContent = await fsPromises.readFile(filePath, 'utf8');
      weldDatabase = JSON.parse(fileContent) as WeldDatabase;
    } catch (error) {
      console.error('Error reading weld parameters database:', error);
      // If file doesn't exist or is invalid, return an empty database
      return NextResponse.json({ 
        success: true, 
        data: {} 
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      data: weldDatabase 
    });
    
  } catch (error) {
    console.error('Error retrieving weld parameters database:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to retrieve weld parameters database' 
    }, { status: 500 });
  }
} 