// DOM Elements
const dropArea = document.getElementById('drop-area');
const fileInput = document.getElementById('file-input');
const selectFileBtn = document.getElementById('select-file-btn');
const previewContainer = document.getElementById('preview-container');
const resultsGrid = document.getElementById('results-grid');
const downloadAllBtn = document.getElementById('download-all-btn');
const clearBtn = document.getElementById('clear-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const formatBtns = document.querySelectorAll('.format-btn');
const qualityControl = document.getElementById('quality-control');
const qualitySlider = document.getElementById('quality-slider');
const qualityValue = document.getElementById('quality-value');

// Current state
let currentMode = 'convert'; // 'compress' or 'convert'
let currentFormat = 'PNG';
let currentQuality = 80; // 默认压缩质量
let processedImages = [];

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
selectFileBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
downloadAllBtn.addEventListener('click', downloadAllImages);
clearBtn.addEventListener('click', clearResults);
qualitySlider.addEventListener('input', updateQualityValue);

// Tab and format selection
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.tab;
        
        // 显示或隐藏质量滑块
        if (currentMode === 'compress') {
            qualityControl.style.display = 'block';
        } else {
            qualityControl.style.display = 'none';
        }
    });
});

formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        formatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFormat = btn.dataset.format;
    });
});

// 更新质量值显示
function updateQualityValue() {
    currentQuality = qualitySlider.value;
    qualityValue.textContent = `${currentQuality}%`;
}

// Initialize the application
function initApp() {
    setupDropArea();
    // 初始化时设置质量滑块的可见性
    if (currentMode === 'compress') {
        qualityControl.style.display = 'block';
    } else {
        qualityControl.style.display = 'none';
    }
}

// Setup drag and drop functionality
function setupDropArea() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    dropArea.addEventListener('drop', handleDrop, false);

    // Setup clipboard paste
    document.addEventListener('paste', handlePaste, false);
}

// Utility functions for drag and drop
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight() {
    dropArea.classList.add('drag-over');
}

function unhighlight() {
    dropArea.classList.remove('drag-over');
}

// Handle dropped files
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
}

// Handle selected files
function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

// Handle pasted images
function handlePaste(e) {
    if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                const files = [file];
                handleFiles(files);
            }
        }
    }
}

// Process the files
async function handleFiles(files) {
    if (files.length === 0) return;
    
    // Show preview container if hidden
    previewContainer.hidden = false;
    
    // Convert FileList to Array
    const fileArray = Array.from(files);
    
    // Filter for image files only
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));
    
    // Process each image
    for (const file of imageFiles) {
        try {
            // Create a placeholder in the results grid
            const placeholderId = `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            createPlaceholder(placeholderId, file.name);
            
            // Process the image
            const result = await processImage(file);
            
            // Update the placeholder with the result
            updateResultItem(placeholderId, result);
            
            // Add to processed images array
            processedImages.push(result);
        } catch (error) {
            console.error('Error processing image:', error);
            // Handle error display
        }
    }
}

// Create a placeholder item in the results grid
function createPlaceholder(id, fileName) {
    const placeholder = document.createElement('div');
    placeholder.className = 'result-item';
    placeholder.id = id;
    placeholder.innerHTML = `
        <div style="height: 150px; display: flex; align-items: center; justify-content: center; background-color: #f0f0f0;">
            <div class="loading"></div>
        </div>
        <div class="result-info">
            <h4>${fileName}</h4>
            <div class="size-info">
                <span>处理中...</span>
            </div>
        </div>
    `;
    resultsGrid.prepend(placeholder);
}

// Update placeholder with processed result
function updateResultItem(id, result) {
    const placeholder = document.getElementById(id);
    if (!placeholder) return;
    
    const savingsPercent = Math.round((1 - (result.newSize / result.originalSize)) * 100);
    placeholder.innerHTML = `
        <div class="image-container">
            <img src="${result.dataUrl}" alt="${result.fileName}">
            <div class="image-stats">
                <div class="size-info">
                    <span class="stat-badge">原始: ${formatFileSize(result.originalSize)}</span>
                    <span class="stat-badge">现在: ${formatFileSize(result.newSize)}</span>
                    <span class="savings stat-badge">-${savingsPercent > 0 ? savingsPercent : 0}%</span>
                </div>
            </div>
        </div>
        <div class="result-info">
            <h4>${result.fileName}</h4>
            <div class="result-actions">
                <button class="download-btn" onclick="downloadSingleImage('${id}')">
                    <i class="fas fa-download"></i> 下载
                </button>
            </div>
        </div>
        </div>
    `;
}

// Process an image based on current mode and format
async function processImage(file) {
    // Create a result object
    const result = {
        fileName: file.name,
        originalSize: file.size,
        originalType: file.type,
        newSize: 0,
        dataUrl: '',
        blob: null,
        targetFormat: currentFormat
    };
    
    // Read the file
    const arrayBuffer = await readFileAsArrayBuffer(file);
    
    // Process based on current mode and format
    let processedBlob;
    
    if (currentMode === 'compress') {
        // 根据不同格式使用不同的压缩策略
        if (currentFormat === 'JPG' || currentFormat === 'JPEG') {
            // 对于JPEG格式，使用imageCompression库确保质量精确控制
            try {
                // 使用browser-image-compression库进行精确控制
                const options = {
                    maxSizeMB: 100, // 设置很大的值，确保只有质量参数起作用
                    maxWidthOrHeight: 8000, // 设置很大的值，确保不会因为尺寸限制而改变质量
                    useWebWorker: true,
                    fileType: 'image/jpeg',
                    quality: currentQuality / 100, // 将百分比转换为0-1之间的值
                    alwaysKeepResolution: true // 确保保持原始分辨率
                };
                
                console.log(`JPEG压缩质量设置为: ${currentQuality}%, 实际质量参数: ${options.quality}`);
                
                // 如果是图片格式不是JPEG，先转换为JPEG
                let jpegFile = file;
                if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
                    // 先转换为JPEG
                    const img = await createImageFromFile(file);
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.fillStyle = 'white'; // 设置白色背景
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                    
                    // 转换为JPEG blob
                    jpegFile = await new Promise((resolve) => {
                        canvas.toBlob((blob) => {
                            resolve(new Blob([blob], { type: 'image/jpeg' }));
                        }, 'image/jpeg', 1.0); // 先用最高质量
                    });
                }
                
                // 使用imageCompression库进行精确压缩
                processedBlob = await imageCompression(jpegFile, options);
                
                // 验证压缩结果
                const compressionRatio = processedBlob.size / file.size;
                console.log(`JPEG压缩比率: ${compressionRatio.toFixed(2)}, 目标质量: ${currentQuality}%`);
            } catch (error) {
                console.error('JPEG compression error:', error);
                processedBlob = file;
            }
        } else if (currentFormat === 'WebP') {
            // 对于WebP格式，直接使用质量参数
            try {
                // 创建canvas并绘制图像
                const img = await createImageFromFile(file);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                
                // 直接使用质量参数
                const quality = currentQuality / 100;
                
                // 转换为blob
                processedBlob = await new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(new Blob([blob], { type: 'image/webp' }));
                    }, 'image/webp', quality);
                });
            } catch (error) {
                console.error('WebP compression error:', error);
                processedBlob = file;
            }
        } else if (currentFormat === 'PNG') {
            // 对于PNG格式，使用更精确的尺寸调整和颜色量化
            try {
                // 创建canvas并绘制图像
                const img = await createImageFromFile(file);
                const canvas = document.createElement('canvas');
                
                // 根据质量参数调整图像尺寸
                let scaleFactor = 1.0;
                if (currentQuality < 90) {
                    // 当质量低于90%时才开始调整尺寸
                    scaleFactor = 0.5 + (currentQuality / 100) * 0.5; // 50%-100%的范围
                }
                
                canvas.width = Math.floor(img.width * scaleFactor);
                canvas.height = Math.floor(img.height * scaleFactor);
                
                const ctx = canvas.getContext('2d');
                
                // 根据质量参数调整图像平滑度
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = currentQuality > 70 ? 'high' : (currentQuality > 40 ? 'medium' : 'low');
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // 转换为blob
                processedBlob = await new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(new Blob([blob], { type: 'image/png' }));
                    }, 'image/png');
                });
            } catch (error) {
                console.error('PNG compression error:', error);
                processedBlob = file;
            }
        } else if (currentFormat === 'GIF' || currentFormat === 'BMP') {
            // 对于GIF和BMP格式，主要通过尺寸调整来控制质量
            try {
                // 创建canvas并绘制图像
                const img = await createImageFromFile(file);
                const canvas = document.createElement('canvas');
                
                // 根据质量参数调整图像尺寸，更精确的控制
                const minScale = 0.3; // 最小缩放比例30%
                const scaleFactor = minScale + (currentQuality / 100) * (1 - minScale);
                
                canvas.width = Math.floor(img.width * scaleFactor);
                canvas.height = Math.floor(img.height * scaleFactor);
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // 获取MIME类型
                const mimeType = `image/${getFormatMimeType(currentFormat)}`;
                
                // 转换为blob
                processedBlob = await new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(new Blob([blob], { type: mimeType }));
                    }, mimeType);
                });
            } catch (error) {
                console.error('Format compression error:', error);
                processedBlob = file;
            }
        } else {
            // 其他格式使用标准压缩
            try {
                // 创建canvas并绘制图像
                const img = await createImageFromFile(file);
                const canvas = document.createElement('canvas');
                
                // 根据质量参数调整图像尺寸
                const scaleFactor = 0.5 + (currentQuality / 100) * 0.5;
                canvas.width = Math.floor(img.width * scaleFactor);
                canvas.height = Math.floor(img.height * scaleFactor);
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // 获取MIME类型
                const mimeType = `image/${getFormatMimeType(currentFormat)}`;
                
                // 转换为blob
                processedBlob = await new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                        resolve(new Blob([blob], { type: mimeType }));
                    }, mimeType, 0.9);
                });
            } catch (error) {
                console.error('Compression error:', error);
                processedBlob = file;
            }
        }
    } else {
        // Convert format
        try {
            processedBlob = await convertFormat(file, currentFormat);
        } catch (error) {
            console.error('Conversion error:', error);
            // Fallback to original
            processedBlob = file;
        }
    }
    
    // Update result object
    result.blob = processedBlob;
    result.newSize = processedBlob.size;
    result.dataUrl = await readFileAsDataURL(processedBlob);
    
    // 添加压缩质量信息
    if (currentMode === 'compress') {
        result.compressionQuality = currentQuality;
    }
    
    return result;
}

// Format conversion helper
async function convertFormat(file, targetFormat) {
    // This is a simplified implementation
    // In a real implementation, you would use specific libraries for each format
    
    // Create a canvas element to convert the image
    const img = await createImageFromFile(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    
    // Get the appropriate MIME type
    const mimeType = `image/${getFormatMimeType(targetFormat)}`;
    
    // 对于一些特殊格式，需要特殊处理
    if (targetFormat === 'AVIF') {
        // 使用avif.js库处理AVIF格式
        try {
            const pngBlob = await new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/png');
            });
            const avifData = await convertToAVIF(pngBlob);
            return new Blob([avifData], { type: 'image/avif' });
        } catch (error) {
            console.error('AVIF conversion error:', error);
            // 如果转换失败，回退到PNG
            return new Promise((resolve) => {
                canvas.toBlob((blob) => resolve(blob), 'image/png');
            });
        }
    } else if (targetFormat === 'BMP') {
        // 手动创建BMP格式的Blob
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const bmpData = createBMPDataArray(imageData);
        return new Blob([bmpData], { type: 'image/bmp' });
    } else if (targetFormat === 'SVG') {
        // 创建简单的SVG，包含图像作为嵌入的base64数据
        const pngBlob = await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
        const pngBase64 = await readFileAsDataURL(pngBlob);
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
            <image href="${pngBase64}" width="${canvas.width}" height="${canvas.height}"/>
        </svg>`;
        return new Blob([svgContent], { type: 'image/svg+xml' });
    } else {
        // 使用标准的canvas.toBlob方法处理其他格式
        return new Promise((resolve) => {
            // 根据不同格式设置不同的质量参数
            if (targetFormat === 'PNG') {
                // PNG是无损格式，不需要质量参数
                canvas.toBlob((blob) => {
                    const newBlob = new Blob([blob], { type: mimeType });
                    resolve(newBlob);
                }, mimeType);
            } else if (targetFormat === 'JPG' || targetFormat === 'JPEG') {
                // JPG是有损格式，设置为最高质量
                canvas.toBlob((blob) => {
                    const newBlob = new Blob([blob], { type: mimeType });
                    resolve(newBlob);
                }, mimeType, 1.0);
            } else if (targetFormat === 'WebP') {
                // WebP可以是有损或无损，设置为最高质量
                canvas.toBlob((blob) => {
                    const newBlob = new Blob([blob], { type: mimeType });
                    resolve(newBlob);
                }, mimeType, 1.0);
            } else if (targetFormat === 'GIF') {
                // GIF需要特殊处理，尝试保持原始质量
                canvas.toBlob((blob) => {
                    const newBlob = new Blob([blob], { type: mimeType });
                    resolve(newBlob);
                }, mimeType);
            } else {
                // 其他格式默认使用高质量
                canvas.toBlob((blob) => {
                    const newBlob = new Blob([blob], { type: mimeType });
                    resolve(newBlob);
                }, mimeType, 1.0);
            }
        });
    }
}

// 转换为AVIF格式
async function convertToAVIF(blob) {
    // 这里使用了avif.js库，但在实际实现中可能需要调整
    // 这是一个简化的实现，实际上需要根据avif.js库的API进行调整
    return new Promise((resolve, reject) => {
        try {
            // 读取blob为ArrayBuffer
            const reader = new FileReader();
            reader.onload = async () => {
                try {
                    // 假设avif.js提供了encode方法
                    // 实际使用时需要根据库的API进行调整
                    if (typeof avif !== 'undefined' && avif.encode) {
                        const result = await avif.encode(reader.result, {
                            quality: 0.8,
                            speed: 8
                        });
                        resolve(result);
                    } else {
                        reject(new Error('AVIF encoding not supported'));
                    }
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsArrayBuffer(blob);
        } catch (error) {
            reject(error);
        }
    });
}

// 创建BMP格式的数据数组
function createBMPDataArray(imageData) {
    const width = imageData.width;
    const height = imageData.height;
    const data = imageData.data;
    
    // BMP文件头 (14 bytes)
    const fileHeaderSize = 14;
    // DIB头 (40 bytes for BITMAPINFOHEADER)
    const dibHeaderSize = 40;
    // 每行字节数必须是4的倍数
    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = fileHeaderSize + dibHeaderSize + pixelArraySize;
    
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);
    
    // 文件头 (14 bytes)
    view.setUint8(0, 0x42); // 'B'
    view.setUint8(1, 0x4D); // 'M'
    view.setUint32(2, fileSize, true); // 文件大小
    view.setUint16(6, 0, true); // 保留
    view.setUint16(8, 0, true); // 保留
    view.setUint32(10, fileHeaderSize + dibHeaderSize, true); // 像素数组偏移
    
    // DIB头 (40 bytes)
    view.setUint32(14, dibHeaderSize, true); // DIB头大小
    view.setInt32(18, width, true); // 宽度
    view.setInt32(22, -height, true); // 高度（负值表示从上到下）
    view.setUint16(26, 1, true); // 颜色平面数
    view.setUint16(28, 24, true); // 每像素位数
    view.setUint32(30, 0, true); // 压缩方法
    view.setUint32(34, pixelArraySize, true); // 像素数组大小
    view.setInt32(38, 2835, true); // 水平分辨率
    view.setInt32(42, 2835, true); // 垂直分辨率
    view.setUint32(46, 0, true); // 调色板颜色数
    view.setUint32(50, 0, true); // 重要颜色数
    
    // 像素数组
    let offset = fileHeaderSize + dibHeaderSize;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            // BMP格式为BGR
            view.setUint8(offset++, data[i + 2]); // B
            view.setUint8(offset++, data[i + 1]); // G
            view.setUint8(offset++, data[i]); // R
        }
        // 行填充到4字节边界
        while (offset % 4 !== 0) {
            view.setUint8(offset++, 0);
        }
    }
    
    return buffer;
}

// Helper to get the correct MIME type
function getFormatMimeType(format) {
    switch (format) {
        case 'PNG': return 'png';
        case 'JPEG': return 'jpeg';
        case 'JPG': return 'jpeg';
        case 'GIF': return 'gif';
        case 'WebP': return 'webp';
        case 'SVG': return 'svg+xml';
        case 'BMP': return 'bmp';
        case 'AVIF': return 'avif';
        default: return 'png';
    }
}

// Create an Image object from a file
function createImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
        img.src = URL.createObjectURL(file);
    });
}

// File readers as promises
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (e) => reject(e);
        reader.readAsArrayBuffer(file);
    });
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

// Format file size
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Download functions
function downloadSingleImage(id) {
    const resultItem = processedImages.find(item => 
        document.getElementById(id).querySelector('img').src === item.dataUrl
    );
    
    if (resultItem) {
        downloadImage(resultItem);
    }
}

function downloadAllImages() {
    if (processedImages.length === 0) return;
    
    // If only one image, download it directly
    if (processedImages.length === 1) {
        downloadImage(processedImages[0]);
        return;
    }
    
    // Create a zip file for multiple images
    // In a real implementation, you would use a library like JSZip
    // For now, download them one by one
    processedImages.forEach(image => {
        downloadImage(image);
    });
}
function downloadImage(image) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(image.blob);
    
    // Get the file extension from targetFormat
    let extension = getFormatMimeType(image.targetFormat);
    // 特殊处理某些扩展名
    if (extension === 'svg+xml') extension = 'svg';
    if (extension === 'jpeg') extension = 'jpg';
    
    const fileName = image.fileName.split('.')[0] + '_compressed.' + extension.toLowerCase();
    
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

// Clear all results
function clearResults() {
    resultsGrid.innerHTML = '';
    processedImages = [];
    previewContainer.hidden = true;
}

// Make downloadSingleImage available globally
window.downloadSingleImage = downloadSingleImage;
