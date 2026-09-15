import { ValidationError } from '@nestjs/common';

const FIELD_LABELS: Record<string, string> = {
  walletId: 'Wallet',
  walletIds: 'Wallet list',
  name: 'Name',
  email: 'Email address',
  password: 'Password',
  amount: 'Amount',
  description: 'Description',
  type: 'Type',
  flow: 'Category type',
  fromDate: 'Start date',
  toDate: 'End date',
  occurredAt: 'Date',
  subcategoryId: 'Subcategory',
  categoryId: 'Category',
  anchorDay: 'Due day',
  color: 'Color',
  initialBalance: 'Starting balance',
  targetBalance: 'Target balance',
  callbackURL: 'Return link',
  redirectTo: 'Return link',
  symbol: 'Symbol',
  initialQuantity: 'Quantity',
  initialPricePerUnitIdr: 'Price per unit',
  pricePerUnitIdr: 'Price per unit',
  quantity: 'Quantity',
  targetQuantity: 'Target quantity',
};

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/([A-Z])/g, ' $1').trim();
}

function humanizeConstraint(field: string, message: string): string {
  const label = fieldLabel(field);

  if (/^property .+ should not exist$/i.test(message)) {
    return 'This field is not supported.';
  }

  if (/should not be empty/i.test(message)) {
    return `${label} is required.`;
  }

  if (/must be an email/i.test(message)) {
    return 'Please enter a valid email address.';
  }

  if (/must be a UUID/i.test(message)) {
    if (field === 'walletId') return 'Please select a wallet.';
    if (field === 'subcategoryId') return 'Please select a subcategory.';
    if (field === 'walletIds') return 'One or more wallet selections are invalid.';
    return `Please select a valid ${label.toLowerCase()}.`;
  }

  if (/must be a valid enum value/i.test(message)) {
    if (field === 'type') return 'Please select a valid type.';
    if (field === 'flow') return 'Please select income or expense.';
    return `Please select a valid ${label.toLowerCase()}.`;
  }

  if (/must be a valid ISO 8601 date string/i.test(message)) {
    if (field === 'fromDate') return 'Please enter a valid start date.';
    if (field === 'toDate') return 'Please enter a valid end date.';
    return 'Please enter a valid date.';
  }

  if (/must be shorter than or equal to (\d+) characters/i.test(message)) {
    const match = message.match(/must be shorter than or equal to (\d+) characters/i);
    const max = match?.[1] ?? '';
    return `${label} must be ${max} characters or less.`;
  }

  if (/must contain at least (\d+) elements/i.test(message)) {
    if (field === 'walletIds') return 'Select at least one wallet to reorder.';
    return `${label} is required.`;
  }

  if (/must be a URL address/i.test(message)) {
    return 'Please provide a valid return link.';
  }

  if (/must be one of the following values/i.test(message)) {
    if (field === 'color') return 'Please choose a valid wallet color.';
    return `Please select a valid ${label.toLowerCase()}.`;
  }

  if (/must be an integer number/i.test(message)) {
    return `${label} must be a whole number.`;
  }

  return message;
}

function flattenValidationErrors(
  errors: ValidationError[],
  parentField = '',
): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const field = parentField
      ? `${parentField}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        messages.push(humanizeConstraint(field.split('.').pop() ?? field, message));
      }
    }

    if (error.children?.length) {
      messages.push(...flattenValidationErrors(error.children, field));
    }
  }

  return messages;
}

export function formatValidationErrors(errors: ValidationError[]): string[] {
  return flattenValidationErrors(errors);
}
