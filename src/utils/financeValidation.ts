import { RefObject } from 'react';
import toast from 'react-hot-toast';

export interface ValidationField {
  name: string;
  label: string;
  value: any;
  required?: boolean;
  ref?: RefObject<HTMLElement>;
  customValidation?: (value: any) => string | null;
}

export const validateFinanceForm = (fields: ValidationField[]) => {
  const errors: Record<string, boolean> = {};
  const errorMessages: string[] = [];
  let firstErrorRef: RefObject<HTMLElement> | null = null;

  for (const field of fields) {
    let hasError = false;
    let errorMessage = '';

    // 1. Check required
    if (field.required) {
      if (
        field.value === undefined ||
        field.value === null ||
        (typeof field.value === 'string' && field.value.trim() === '') ||
        (typeof field.value === 'number' && isNaN(field.value))
      ) {
        hasError = true;
        errorMessage = field.label;
      }
    }

    // 2. Custom validation
    if (!hasError && field.customValidation && field.value) {
      const customError = field.customValidation(field.value);
      if (customError) {
        hasError = true;
        errorMessage = customError;
      }
    }

    if (hasError) {
      errors[field.name] = true;
      if (errorMessage && !errorMessages.includes(errorMessage)) {
        errorMessages.push(errorMessage);
      }
      if (!firstErrorRef && field.ref && field.ref.current) {
        firstErrorRef = field.ref;
      }
    }
  }

  const isValid = errorMessages.length === 0;

  if (!isValid) {
    toast.error(`Please fill required/invalid fields:\n${errorMessages.join(', ')}`, {
      duration: 5000,
    });
    // Focus first error
    if (firstErrorRef?.current) {
      firstErrorRef.current.focus();
    }
  }

  return { isValid, errors };
};
