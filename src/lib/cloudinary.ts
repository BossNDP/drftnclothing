/**
 * Cloudinary URL Optimization Helper
 * 
 * Inserts Cloudinary delivery parameters into product image URLs to optimize format,
 * quality, and dimensions. Gracefully passes non-Cloudinary/external URLs through unchanged.
 */

/**
 * Optimizes a Cloudinary image URL by inserting format, quality, crop, and width parameters.
 *
 * Example transformation:
 * input:  https://res.cloudinary.com/demo/image/upload/v12345/sample.jpg
 * output: https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_800/v12345/sample.jpg
 *
 * @param url The raw image URL
 * @param width The target width in pixels
 */
export function getOptimizedImageUrl(url: string | undefined | null, width: number): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Check if it's a Cloudinary URL
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url;
  }

  try {
    const parts = url.split('/image/upload/');
    if (parts.length !== 2) {
      return url;
    }

    const baseUrl = parts[0];
    const rest = parts[1];
    const segments = rest.split('/');

    const transformations: string[] = [];
    const restPath: string[] = [];
    
    let lookingForTransformations = true;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      
      // The last segment is always part of the public ID / file name
      if (i === segments.length - 1) {
        restPath.push(seg);
        break;
      }
      
      // If it looks like a version segment, it's not a transformation. All subsequent segments are also not transformations.
      if (/^v\d+$/.test(seg)) {
        lookingForTransformations = false;
      }
      
      if (lookingForTransformations) {
        // Check if it matches a standard Cloudinary transformation parameter prefix followed by value
        const paramRegex = /^(c|w|h|f|q|r|e|bo|bg|co|dpr|x|y|a|o|fl|l|u|pg|dl)_[a-zA-Z0-9_.-]+$/;
        const subSegments = seg.split(',');
        const isTransformation = subSegments.every((sub) => paramRegex.test(sub));
        
        if (isTransformation) {
          transformations.push(seg);
        } else {
          // If a segment doesn't look like a transformation, we treat it as folders / path of public ID.
          lookingForTransformations = false;
          restPath.push(seg);
        }
      } else {
        restPath.push(seg);
      }
    }

    const deliveryParams = `f_auto,q_auto,fl_progressive,c_fill,w_${width}`;
    return `${baseUrl}/image/upload/${deliveryParams}/${restPath.join('/')}`;
  } catch (error) {
    console.error('Error optimizing Cloudinary image URL:', error);
    return url;
  }
}

/**
 * Generates a low-res blurred Cloudinary image URL for placeholders.
 * Uses the e_blur:1000,q_1 delivery parameters.
 *
 * @param url The raw image URL
 */
export function getBlurPlaceholderUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Check if it's a Cloudinary URL
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url;
  }

  try {
    const parts = url.split('/image/upload/');
    if (parts.length !== 2) {
      return url;
    }

    const baseUrl = parts[0];
    const rest = parts[1];
    const segments = rest.split('/');

    const restPath: string[] = [];
    let lookingForTransformations = true;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (i === segments.length - 1) {
        restPath.push(seg);
        break;
      }
      if (/^v\d+$/.test(seg)) {
        lookingForTransformations = false;
      }
      if (lookingForTransformations) {
        const paramRegex = /^(c|w|h|f|q|r|e|bo|bg|co|dpr|x|y|a|o|fl|l|u|pg|dl)_[a-zA-Z0-9_.-]+$/;
        const subSegments = seg.split(',');
        const isTransformation = subSegments.every((sub) => paramRegex.test(sub));
        if (!isTransformation) {
          lookingForTransformations = false;
          restPath.push(seg);
        }
      } else {
        restPath.push(seg);
      }
    }

    const deliveryParams = 'e_blur:1000,q_1,f_auto,w_50';
    return `${baseUrl}/image/upload/${deliveryParams}/${restPath.join('/')}`;
  } catch (error) {
    return url;
  }
}

