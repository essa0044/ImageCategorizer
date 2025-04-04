import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import UploadControls from './components/UploadControls.jsx';
import CategoryList from './components/CategoryList';
import CanvasComponent from './components/CanvasComponent';
import DetailsPanel from './components/DetailsPanel';
import './App.css'; // for custom styles

// Proxy-configuration in vite.config.js for /api requests to the backend 

function App() {
    const [uploadedImage, setUploadedImage] = useState(null); // URL or data from uploaded image
    const [categories, setCategories] = useState([]);
    const [rectangles, setRectangles] = useState([]); // { id, x, y, width, height, categoryId, hierarchy }
    const [selectedRectId, setSelectedRectId] = useState(null);
    const [autoClassified, setAutoClassified] = useState(false); // flag for auto-classification
    const [isLoading, setIsLoading] = useState(false);
    const [classifyOnUploadFlag, setClassifyOnUploadFlag] = useState(false);

    // Fetch categories on load
    useEffect(() => {
        axios.get('/api/categories')
            .then(response => setCategories(response.data))
            .catch(error => console.error('Error fetching categories:', error));
    }, []);

    // Trigger Auto-Classify when image is loaded AND the flag was set
    useEffect(() => {
      if (uploadedImage && classifyOnUploadFlag) {
        //   handleAutoClassify(uploadedImage);
          setClassifyOnUploadFlag(false); // Reset flag after triggering
      }
  }, [uploadedImage, classifyOnUploadFlag]); // dependecies: image and flag


    const handleFileUpload = useCallback((file, classifyOnUpload) => {
      setIsLoading(true);
      setClassifyOnUploadFlag(classifyOnUpload); // Set flag for useEffect
      const formData = new FormData();
      formData.append('file', file);
      // send flag to backend, if needed, even though we don't use it currently
      formData.append('classifyOnUpload', classifyOnUpload);

      axios.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then(response => {
          console.log('Upload response:', response.data);
          // IMPORTANT: Use the URL returned by the backend
          setUploadedImage(response.data.image_url); // <-- sets URL of the uploaded image
          setRectangles([]);
          setSelectedRectId(null);
          setAutoClassified(false);
          setIsLoading(false);
          // auto-classification will be triggered in the useEffect above,
          // if classifyOnUploadFlag and uploadedImage was set to true
      })
      .catch(error => {
          console.error('Error uploading file:', error);
          setIsLoading(false);
          setClassifyOnUploadFlag(false); // Reset flag on error
      });
  }, []); // handleAutoClassify as dependency to ensure it's up-to-date


  const handleAutoClassify = useCallback((imageUrlToClassify) => {
    if (!imageUrlToClassify) return;
    setIsLoading(true);
    console.log("Triggering auto-classify for:", imageUrlToClassify); // Debug Log
    axios.post('/api/auto-classify', { image_url: imageUrlToClassify }) // send Image-URL
        .then(response => {
            setRectangles(response.data.rectangles || []);
            setAutoClassified(response.data.autoClassified || false);
            setIsLoading(false);
        })
        .catch(error => {
            console.error('Error during auto-classification:', error);
            setIsLoading(false);
        });
  }, []); // no dependencies, as we use only use parameters

    const addRectangle = useCallback((newRect) => {
        // adds rectangle (e.g. per drag-and-drop)
        setRectangles(prev => [...prev, { ...newRect, id: `rect-${Date.now()}` }]); // generate Unique ID
    }, []);

    const updateRectangle = useCallback((id, updatedProps) => {
        setRectangles(prev =>
            prev.map(rect =>
                rect.id === id ? { ...rect, ...updatedProps } : rect
            )
        );
    }, []);

    const handleRectangleSelect = useCallback((id) => {
        setSelectedRectId(id);
    }, []);

    const getSelectedRectangle = () => {
        return rectangles.find(rect => rect.id === selectedRectId);
    };

    const changeRectangleCategory = useCallback((rectId, newCategoryId) => {
        updateRectangle(rectId, { categoryId: newCategoryId });
    }, [updateRectangle]);

    const changeRectangleHierarchy = useCallback((rectId, newHierarchy) => {
        updateRectangle(rectId, { hierarchy: newHierarchy });
     }, [updateRectangle]);

    const handleSubmit = useCallback(() => {
        setIsLoading(true);
        const dataToSubmit = {
            image: uploadedImage, // or relevant image-ID/Data
            rectangles: rectangles,
        };
        axios.post('/api/submit', dataToSubmit)
          .then(response => {
            console.log("Submission successful:", response.data);
            alert('Classification submitted!');
            setIsLoading(false);
            // Optional: Reset state or navigate away
          })
          .catch(error => {
            console.error("Error submitting classification:", error);
            alert('Submission failed!');
            setIsLoading(false);
          });
    }, [uploadedImage, rectangles]);

    // --- Drag and Drop Handling ---
    const handleDragCategoryStart = (e, category) => {
        e.dataTransfer.setData('category', JSON.stringify(category));
    };

    const handleCanvasDrop = (e) => {
        e.preventDefault();
        const categoryString = e.dataTransfer.getData('category');
        if (!categoryString) return;

        const category = JSON.parse(categoryString);
        // Get drop position relative to the stage/canvas
        // This requires access to the Konva stage reference, might need adjustments
        const stage = e.target.getStage ? e.target.getStage() : null; // Assuming drop is on Konva stage/layer
         if (!stage) {
             console.warn("Could not get Konva stage from drop target");
             return;
         }
        const pos = stage.getPointerPosition();

        if (pos) {
            addRectangle({
                x: pos.x - 50, // Offset to center the default rect
                y: pos.y - 25,
                width: 100,
                height: 50,
                categoryId: category.id,
                hierarchy: '', // Default hierarchy
            });
        }
    };

    const handleCanvasDragOver = (e) => {
        e.preventDefault(); // Necessary to allow dropping
    };
    // --- End Drag and Drop ---


    return (
        <div className="container-fluid mt-3">
            <h1>Exam Classification Tool</h1>
            <hr />

            <UploadControls
                onFileUpload={handleFileUpload}
                onAutoClassify={() => handleAutoClassify(uploadedImage)}
                onSubmit={handleSubmit}
                showAutoClassifyButton={uploadedImage && !autoClassified}
                isLoading={isLoading}
            />

            <hr />

            {isLoading && <div className="alert alert-info">Loading...</div>}

            <div className="row g-3 main-layout">
                {/* Left Panel: Categories */}
                <div className="col-md-2 category-panel">
                    <h2>Categories</h2>
                    <CategoryList
                        categories={categories}
                        onDragStart={handleDragCategoryStart}
                    />
                </div>

                {/* Center Panel: Canvas */}
                <div className="col-md-8 canvas-panel"
                     onDrop={handleCanvasDrop}
                     onDragOver={handleCanvasDragOver}>
                    <CanvasComponent
                        imageSrc={uploadedImage}
                        rectangles={rectangles}
                        selectedRectId={selectedRectId}
                        onRectSelect={handleRectangleSelect}
                        onRectChange={updateRectangle} // Pass update function for drag/resize
                        categories={categories} // Pass categories for color lookup
                    />
                </div>

                {/* Right Panel: Details */}
                <div className="col-md-2 details-panel">
                    {selectedRectId && getSelectedRectangle() && (
                        <DetailsPanel
                            rectangle={getSelectedRectangle()}
                            categories={categories}
                            onChangeCategory={changeRectangleCategory}
                            onChangeHierarchy={changeRectangleHierarchy}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;