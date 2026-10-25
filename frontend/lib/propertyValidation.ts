/**
 * Property validation utilities for creation and editing forms
 */

import { Neighborhood } from './properties'

export interface PropertyFormData {
  title: string
  neighborhood: Neighborhood
  priceEtb: number
  beds: number
  baths: number
  sizeSqm: number
  description: string
  images: File[]
  propertyType: 'apartment' | 'house' | 'studio' | 'villa'
  amenities: string[]
}

/**
 * Validate property form data and return array of error messages
 * @param data Property form data to validate
 * @returns Array of error messages (empty if valid)
 */
export function validatePropertyForm(data: Partial<PropertyFormData>): string[] {
  const errors: string[] = []

  // Title validation
  if (!data.title || data.title.trim().length < 5) {
    errors.push('Title must be at least 5 characters')
  }

  // Neighborhood validation
  if (!data.neighborhood) {
    errors.push('Neighborhood is required')
  }

  // Price validation
  if (!data.priceEtb || data.priceEtb <= 0) {
    errors.push('Price must be greater than 0')
  }

  // Bedrooms validation
  if (!data.beds || data.beds < 1) {
    errors.push('Number of bedrooms is required')
  }

  // Bathrooms validation
  if (!data.baths || data.baths < 1) {
    errors.push('Number of bathrooms is required')
  }

  // Description validation
  if (!data.description || data.description.trim().length < 20) {
    errors.push('Description must be at least 20 characters')
  }

  return errors
}

/**
 * Validate individual field for real-time validation
 * @param fieldName Name of the field to validate
 * @param value Value of the field
 * @returns Error message or null if valid
 */
export function validateField(
  fieldName: keyof PropertyFormData,
  value: any
): string | null {
  switch (fieldName) {
    case 'title':
      if (!value || value.trim().length < 5) {
        return 'Title must be at least 5 characters'
      }
      break

    case 'neighborhood':
      if (!value) {
        return 'Neighborhood is required'
      }
      break

    case 'priceEtb':
      if (!value || value <= 0) {
        return 'Price must be greater than 0'
      }
      break

    case 'beds':
      if (!value || value < 1) {
        return 'Number of bedrooms is required'
      }
      break

    case 'baths':
      if (!value || value < 1) {
        return 'Number of bathrooms is required'
      }
      break

    case 'description':
      if (!value || value.trim().length < 20) {
        return 'Description must be at least 20 characters'
      }
      break
  }

  return null
}
