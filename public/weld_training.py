import os
import time
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torchvision import models, transforms
from torchvision.datasets import ImageFolder
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.multiclass import OneVsOneClassifier
from sklearn.metrics import accuracy_score, confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns
import joblib
import random

# Set random seeds for reproducibility
random.seed(42)
np.random.seed(42)
torch.manual_seed(42)
if torch.cuda.is_available():
    torch.cuda.manual_seed_all(42)

# Configuration
class Config:
    data_path = "E:/Matlab Drive/Dataset/Weld Images"  # Update with your path
    batch_size = 32
    test_size = 0.3
    max_samples_per_class = 305  # As in the MATLAB code
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    feature_layer = "pool5"  # This will be translated to the corresponding PyTorch layer
    
config = Config()
print(f"Using device: {config.device}")

# Define transforms similar to what was used in MATLAB
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

# Custom dataset to balance classes and limit samples as in MATLAB
class BalancedDataset(Dataset):
    def __init__(self, root_dir, transform=None, max_samples=None):
        self.dataset = ImageFolder(root_dir, transform=transform)
        self.transform = transform
        self.class_indices = self._get_class_indices()
        self.max_samples = max_samples
        self.balanced_indices = self._balance_classes()
        
    def _get_class_indices(self):
        class_indices = {}
        for idx, (_, label) in enumerate(self.dataset.samples):
            if label not in class_indices:
                class_indices[label] = []
            class_indices[label].append(idx)
        return class_indices
    
    def _balance_classes(self):
        if self.max_samples is None:
            min_samples = min(len(indices) for indices in self.class_indices.values())
        else:
            min_samples = min(self.max_samples, min([len(indices) for indices in self.class_indices.values()]))
        
        balanced_indices = []
        for label, indices in self.class_indices.items():
            # Randomly select min_samples indices
            selected_indices = random.sample(indices, min_samples)
            balanced_indices.extend(selected_indices)
        
        return balanced_indices
    
    def __len__(self):
        return len(self.balanced_indices)
    
    def __getitem__(self, idx):
        dataset_idx = self.balanced_indices[idx]
        return self.dataset[dataset_idx]

# Load and prepare the dataset
dataset = BalancedDataset(config.data_path, transform=transform, max_samples=config.max_samples_per_class)

# Print class distribution
class_counts = {}
for idx in dataset.balanced_indices:
    label = dataset.dataset.targets[idx]
    class_name = dataset.dataset.classes[label]
    if class_name not in class_counts:
        class_counts[class_name] = 0
    class_counts[class_name] += 1

print("Class distribution after balancing:")
for class_name, count in class_counts.items():
    print(f"{class_name}: {count}")

# Split into train and test sets
train_indices, test_indices = train_test_split(
    range(len(dataset.balanced_indices)),
    test_size=config.test_size,
    stratify=[dataset.dataset.targets[dataset.balanced_indices[i]] for i in range(len(dataset.balanced_indices))],
    random_state=42
)

# Create data loaders
train_sampler = torch.utils.data.SubsetRandomSampler(train_indices)
test_sampler = torch.utils.data.SubsetRandomSampler(test_indices)

train_loader = DataLoader(
    dataset, 
    batch_size=config.batch_size,
    sampler=train_sampler
)

test_loader = DataLoader(
    dataset,
    batch_size=config.batch_size,
    sampler=test_sampler
)

# Load pre-trained ResNet-18
model = models.resnet18(pretrained=True)
model = model.to(config.device)
model.eval()  # Set to evaluation mode

# Define a hook to extract features from specified layer
activation = {}
def get_activation(name):
    def hook(model, input, output):
        activation[name] = output.detach()
    return hook

# Attach the hook to the avgpool layer (equivalent to 'pool5' in MATLAB)
model.avgpool.register_forward_hook(get_activation('avgpool'))

def extract_features(dataloader):
    """Extract features from the specified layer using the pre-trained model"""
    features = []
    labels = []
    
    with torch.no_grad():
        for images, targets in dataloader:
            images = images.to(config.device)
            # Forward pass
            _ = model(images)
            # Get the features from the hooked layer
            batch_features = activation['avgpool'].squeeze().cpu().numpy()
            features.append(batch_features)
            labels.append(targets.numpy())
    
    return np.vstack(features), np.concatenate(labels)

# Extract features for training and testing
print("Extracting features for training set...")
train_features, train_labels = extract_features(train_loader)
print(f"Training features shape: {train_features.shape}")

print("Extracting features for test set...")
test_features, test_labels = extract_features(test_loader)
print(f"Test features shape: {test_features.shape}")

# Train SVM classifier
print("Training SVM classifier...")
start_time = time.time()
classifier = OneVsOneClassifier(SVC(kernel='linear'))
classifier.fit(train_features, train_labels)
training_time = time.time() - start_time
print(f"Training completed in {training_time:.2f} seconds")

# Evaluate classifier
print("Evaluating classifier...")
pred_labels = classifier.predict(test_features)
accuracy = accuracy_score(test_labels, pred_labels)
print(f"Accuracy: {accuracy:.4f}")

# Create confusion matrix
cm = confusion_matrix(test_labels, pred_labels)
class_names = dataset.dataset.classes

# Plot confusion matrix
plt.figure(figsize=(10, 8))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=class_names, yticklabels=class_names)
plt.xlabel('Predicted')
plt.ylabel('True')
plt.title('Confusion Matrix')
plt.savefig('confusion_matrix.png')
print("Confusion matrix saved to 'confusion_matrix.png'")

# Save the model
output = {
    'classifier': classifier,
    'class_names': class_names,
    'feature_extractor': {
        'name': 'resnet18',
        'layer': 'avgpool'
    }
}

joblib.dump(output, 'weld_classifier_model.pkl')
print("Model saved to 'weld_classifier_model.pkl'")

# Save only the classifier (smaller file)
joblib.dump(classifier, 'weld_classifier_svm.pkl')
print("SVM classifier saved to 'weld_classifier_svm.pkl'")

# Additional information
print("\nModel Summary:")
print(f"- Number of classes: {len(class_names)}")
print(f"- Classes: {class_names}")
print(f"- Feature dimension: {train_features.shape[1]}")
print(f"- Training samples: {train_features.shape[0]}")
print(f"- Test samples: {test_features.shape[0]}")
print(f"- Test accuracy: {accuracy:.4f}")
