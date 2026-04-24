export function getApiErrorPayload(error) {
  const constraint = String(error?.constraint || '').toLowerCase()

  if (error?.code === '23505') {
    if (constraint.includes('sku')) {
      return {
        statusCode: 409,
        message: 'SKU already exists. Use a different SKU.',
      }
    }

    if (constraint.includes('email')) {
      return {
        statusCode: 409,
        message: 'Email already exists. Use a different email address.',
      }
    }
  }

  if (error?.code === '23514' && constraint.includes('quantity')) {
    return {
      statusCode: 400,
      message: 'Quantity must be zero or more.',
    }
  }

  if (error?.code === '22001') {
    return {
      statusCode: 400,
      message: 'One of the product fields is too long.',
    }
  }

  if (error?.code === '22P02') {
    return {
      statusCode: 400,
      message: 'One of the submitted values is invalid.',
    }
  }

  return {
    statusCode: 500,
    message: 'Internal server error',
  }
}
