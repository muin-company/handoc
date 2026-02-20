/**
 * ProseMirror plugin for handling image insertion via drop and paste.
 */
import { Plugin } from 'prosemirror-state';
import { Schema } from 'prosemirror-model';

/**
 * Convert a File object to a base64 data URL
 */
async function fileToDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader is not available in this environment'));
      return;
    }
    
    const reader = new FileReader();
    
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a file is an image
 */
function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Extract image files from DataTransfer object
 */
function extractImageFiles(dataTransfer: DataTransfer): File[] {
  const files: File[] = [];
  
  if (dataTransfer.files) {
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (file && isImageFile(file)) {
        files.push(file);
      }
    }
  }
  
  return files;
}

/**
 * Plugin for handling image drops and paste
 */
export function imagePlugin(schema: Schema) {
  return new Plugin({
    props: {
      /**
       * Handle drop events
       */
      handleDrop(view, event, slice, moved) {
        // Only handle if there are files
        if (!event.dataTransfer?.files?.length) {
          return false;
        }

        const imageFiles = extractImageFiles(event.dataTransfer);
        
        if (imageFiles.length === 0) {
          return false;
        }

        // Prevent default drop behavior
        event.preventDefault();

        // Get drop position
        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        if (!coordinates) {
          return true;
        }

        // Insert images
        Promise.all(imageFiles.map(file => fileToDataURL(file)))
          .then(dataURLs => {
            const { tr } = view.state;
            let pos = coordinates.pos;

            dataURLs.forEach((dataURL, index) => {
              const imageNode = schema.nodes.image.create({
                src: dataURL,
                alt: imageFiles[index].name,
              });

              tr.insert(pos, imageNode);
              pos += imageNode.nodeSize;
            });

            view.dispatch(tr);
          })
          .catch(err => {
            console.error('Failed to insert images:', err);
          });

        return true;
      },

      /**
       * Handle paste events
       */
      handlePaste(view, event, slice) {
        // Check for files in clipboard
        if (!event.clipboardData?.files?.length) {
          return false;
        }

        const imageFiles = extractImageFiles(event.clipboardData);
        
        if (imageFiles.length === 0) {
          return false;
        }

        // Prevent default paste behavior
        event.preventDefault();

        // Insert images at current selection
        Promise.all(imageFiles.map(file => fileToDataURL(file)))
          .then(dataURLs => {
            const { tr, selection } = view.state;
            let pos = selection.from;

            dataURLs.forEach((dataURL, index) => {
              const imageNode = schema.nodes.image.create({
                src: dataURL,
                alt: imageFiles[index].name,
              });

              tr.insert(pos, imageNode);
              pos += imageNode.nodeSize;
            });

            view.dispatch(tr);
          })
          .catch(err => {
            console.error('Failed to paste images:', err);
          });

        return true;
      },
    },
  });
}
