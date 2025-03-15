import os
import numpy as np
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import joblib
import argparse
from pathlib import Path
import matplotlib.pyplot as plt

class WeldPredictor:
    def __init__(self, model_path):
        # Load the model
        self.model_data = joblib.load(model_path)
        self.classifier = self.model_data['classifier']
        self.class_names = self.model_data['class_names']
        
        # Setup feature extractor
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = models.resnet18(pretrained=True)
        self.model = self.model.to(self.device)
        self.model.eval()
        
        # Define the transformation for input images
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        # Setup hooks
        self.activation = {}
        self.model.avgpool.register_forward_hook(self._get_activation('avgpool'))
        
    def _get_activation(self, name):
        def hook(model, input, output):
            self.activation[name] = output.detach()
        return hook
    
    def extract_features(self, image):
        """Extract features from a single image"""
        with torch.no_grad():
            # Preprocess image
            image_tensor = self.transform(image).unsqueeze(0).to(self.device)
            
            # Forward pass
            _ = self.model(image_tensor)
            
            # Get the features
            features = self.activation['avgpool'].squeeze().cpu().numpy()
            
            # If the features are 0-dimensional (single image), expand to 2D array
            if features.ndim == 1:
                features = features.reshape(1, -1)
                
            return features
    
    def predict(self, image_path):
        """Predict the class of an image"""
        # Load image
        image = Image.open(image_path).convert('RGB')
        
        # Extract features
        features = self.extract_features(image)
        
        # Predict class
        pred_label = self.classifier.predict(features)[0]
        pred_class = self.class_names[pred_label]
        
        # Get confidence scores if available
        if hasattr(self.classifier, 'decision_function'):
            scores = self.classifier.decision_function(features)
            # Normalize scores to [0, 1] for easier interpretation
            if scores.ndim > 1:
                # Multi-class case
                scores = np.exp(scores) / np.sum(np.exp(scores), axis=1).reshape(-1, 1)
                confidence = scores[0, pred_label]
            else:
                # Binary case
                confidence = 1 / (1 + np.exp(-scores[0]))
        else:
            confidence = None
        
        return pred_class, confidence
    
    def predict_batch(self, image_dir, pattern="*.jpg"):
        """Predict classes for all images in a directory"""
        results = []
        
        # Get all image files
        image_paths = list(Path(image_dir).glob(pattern))
        
        for image_path in image_paths:
            pred_class, confidence = self.predict(image_path)
            results.append({
                'image_path': str(image_path),
                'predicted_class': pred_class,
                'confidence': confidence
            })
            
        return results

def visualize_prediction(image_path, pred_class, confidence=None):
    """Visualize the prediction on the image"""
    image = Image.open(image_path).convert('RGB')
    
    plt.figure(figsize=(8, 6))
    plt.imshow(image)
    
    title = f"Predicted: {pred_class}"
    if confidence is not None:
        title += f" (Confidence: {confidence:.2f})"
    
    plt.title(title)
    plt.axis('off')
    
    # Save the visualization
    output_path = f"prediction_{Path(image_path).stem}.png"
    plt.savefig(output_path)
    plt.close()
    
    return output_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Predict weld image class')
    parser.add_argument('--model', type=str, default='weld_classifier_model.pkl',
                        help='Path to the trained model file')
    parser.add_argument('--image', type=str, required=True,
                        help='Path to image file or directory')
    parser.add_argument('--batch', action='store_true',
                        help='Process a batch of images in a directory')
    parser.add_argument('--pattern', type=str, default="*.jpg",
                        help='Pattern for matching image files in batch mode')
    parser.add_argument('--visualize', action='store_true',
                        help='Create visualization of predictions')
    
    args = parser.parse_args()
    
    # Initialize predictor
    predictor = WeldPredictor(args.model)
    
    if args.batch:
        # Batch prediction
        print(f"Processing images in {args.image} with pattern {args.pattern}")
        results = predictor.predict_batch(args.image, args.pattern)
        
        # Print results
        print("\nPrediction Results:")
        for result in results:
            print(f"Image: {Path(result['image_path']).name}")
            print(f"Predicted class: {result['predicted_class']}")
            if result['confidence'] is not None:
                print(f"Confidence: {result['confidence']:.4f}")
            print("---")
            
            # Visualize if requested
            if args.visualize:
                output_path = visualize_prediction(
                    result['image_path'], 
                    result['predicted_class'], 
                    result['confidence']
                )
                print(f"Visualization saved to {output_path}")
    else:
        # Single image prediction
        pred_class, confidence = predictor.predict(args.image)
        
        print("\nPrediction Result:")
        print(f"Image: {Path(args.image).name}")
        print(f"Predicted class: {pred_class}")
        if confidence is not None:
            print(f"Confidence: {confidence:.4f}")
        
        # Visualize if requested
        if args.visualize:
            output_path = visualize_prediction(args.image, pred_class, confidence)
            print(f"Visualization saved to {output_path}")
