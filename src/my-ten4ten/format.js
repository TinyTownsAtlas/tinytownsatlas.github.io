// Plain-language text for results. No medical interpretation: values are shown as recorded.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function shortDate(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function formatNumber(value, decimals = 0) {
  return Number(value).toFixed(decimals);
}

export function formatValue(entry, value) {
  if (entry.kind === 'category') return entry.categories?.[value] ?? String(value);
  const number = formatNumber(value, entry.decimals ?? 0);
  return entry.unit ? `${number} ${entry.unit}` : number;
}

const STATE_TEXT = {
  not_recorded: 'Not recorded',
  declined: 'You chose not to do this test',
  unable: 'Not able to complete this test',
  under_review: 'Being checked before it can be shown',
};

export function stateText(state) {
  return STATE_TEXT[state] || 'Not recorded';
}

const CAUTION_TEXT = {
  caution_technique: 'Height and waist can be measured differently between screenings, so a small change in BMI may not be real.',
  caution_meal_time: 'The time since your last meal was not recorded, so small changes in this reading may not mean much.',
  caution_protocol: 'The chair stand test can be run a little differently between screenings, so a change may not reflect strength alone. Your health worker can explain what it means for you.',
};

// One line beside each screening's status, so no pill stands alone.
export function statusNote(status) {
  switch (status) {
    case 'results_ready': return 'Results are shown below.';
    case 'being_checked': return 'The team is checking these results before they can be shown.';
    default: return 'These results are not available here yet.';
  }
}

export function cautionText(comparability) {
  return CAUTION_TEXT[comparability] || '';
}

export function pillFor(status) {
  switch (status) {
    case 'results_ready': return { text: 'Results ready', cls: 'pill pill-ready' };
    case 'being_checked': return { text: 'Being checked', cls: 'pill pill-check' };
    default: return { text: 'Not available yet', cls: 'pill pill-none' };
  }
}

// One sentence describing a change between two consecutive screenings.
export function changeSentence(comparison, change) {
  const from = `${formatValue(comparison, change.from.value)} on ${formatDate(change.from.date)}`;
  const to = `${formatValue(comparison, change.to.value)} on ${formatDate(change.to.date)}`;
  if (comparison.kind === 'category') {
    const verb = change.direction === 'changed' ? 'Changed' : 'No change';
    return `${verb}: ${from} → ${to}.`;
  }
  const size = formatNumber(Math.abs(change.delta), comparison.decimals);
  const unit = comparison.unit ? ` ${comparison.unit}` : '';
  let outcome = 'No change.';
  if (change.direction === 'higher') outcome = `Higher by ${size}${unit}.`;
  if (change.direction === 'lower') outcome = `Lower by ${size}${unit}.`;
  return `${from} → ${to}. ${outcome}`;
}

// Short change text for a trend card.
export function shortChange(comparison, change) {
  if (comparison.kind === 'category') {
    const from = comparison.categories?.[change.from.value] ?? change.from.value;
    const to = comparison.categories?.[change.to.value] ?? change.to.value;
    return change.direction === 'changed' ? `${from} → ${to}` : `No change (${to})`;
  }
  const size = formatNumber(Math.abs(change.delta), comparison.decimals);
  const unit = comparison.unit ? ` ${comparison.unit}` : '';
  if (change.direction === 'higher') return `Higher by ${size}${unit}`;
  if (change.direction === 'lower') return `Lower by ${size}${unit}`;
  return 'No change';
}
