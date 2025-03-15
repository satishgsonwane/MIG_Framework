import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    
    if (!image) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }
    
    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }
    
    // Generate a unique filename
    const fileName = `roi_${Date.now()}.png`;
    const filePath = join(uploadsDir, fileName);
    
    // Convert file to buffer and save it
    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(filePath, buffer);
    
    // Return the relative path to the file
    const relativePath = `/uploads/${fileName}`;
    
    return NextResponse.json({ 
      success: true, 
      filePath: relativePath 
    });
  } catch (error) {
    console.error('Error saving image:', error);
    return NextResponse.json(
      { error: 'Failed to save image' },
      { status: 500 }
    );
  }
} 