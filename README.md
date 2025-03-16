# MIG Welding Analysis Framework

A comprehensive framework for analyzing MIG (Metal Inert Gas) welding quality using machine learning models. This system combines real-time video analysis with deep learning models to detect and classify welding defects.

## Features

- Real-time video feed analysis from welding camera
- Image import and ROI (Region of Interest) selection
- Automated weld quality assessment
- Defect classification with detailed analysis
- Causes and remedies suggestions for identified defects
- Support for both MATLAB and ONNX models

## Defect Types Detected

1. Burn Through
2. Contamination
3. Lack of Fusion
4. Lack of Penetration
5. Misalignment

## Prerequisites

- Python 3.8 or higher
- Node.js 16.x or higher
- MATLAB R2021b or higher (optional, for MATLAB-based analysis)
- CUDA-compatible GPU (recommended for optimal performance)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd MIG_Framework
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

3. Install Node.js dependencies:
```bash
npm install
```

4. (Optional) Install MATLAB Engine for Python:
```matlab
cd (fullfile(matlabroot,'extern','engines','python'))
system('python setup.py install')
```

## Configuration

1. Place your trained models in the `public` directory:
   - For ONNX: `net2.onnx` and `net5.onnx`
   - For MATLAB: `net2.mat` and `net5.mat`

2. Configure the camera settings in the application if needed.

## Usage

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to `http://localhost:3000`

3. Use the application through the web interface:
   - Import images or use live camera feed
   - Select ROI for analysis
   - View analysis results and recommendations

## API Endpoints

### POST `/api/run-dss-analysis`
Analyzes a welding image and returns quality assessment results.

Request body:
```json
{
  "imagePath": "string"
}
```

Response:
```json
{
  "classification": "string",
  "confidence": "number",
  "defect_type": "string",
  "defect_confidence": "number",
  "message": "string"
}
```

## Project Structure

```
MIG_Framework/
├── public/
│   ├── dss.py
│   ├── net2.onnx
│   └── net5.onnx
├── src/
│   ├── app/
│   │   └── api/
│   └── components/
│       └── VideoAnalysisApp.tsx
├── package.json
└── requirements.txt
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
