import type { MetadataFieldDefinition, MetadataValue } from '../types/domain'
import { FormField } from './FormField'

export function MetadataFields({
  definitions,
  values,
  onChange,
}: {
  definitions: MetadataFieldDefinition[]
  values: Record<string, MetadataValue>
  onChange: (next: Record<string, MetadataValue>) => void
}) {
  if (!definitions.length) return null
  return <fieldset className="field-group"><legend>Custom fields</legend>{definitions.map((field) => {
    const value = values[field.id]
    if (field.fieldType === 'boolean') {
      return <label className="toggle-row" key={field.id}><span>{field.name}</span><input type="checkbox" checked={value === true} onChange={(event) => onChange({ ...values, [field.id]: event.target.checked })} /></label>
    }
    if (field.fieldType === 'choice') {
      return <FormField key={field.id} label={field.name}><select value={typeof value === 'string' ? value : ''} onChange={(event) => onChange({ ...values, [field.id]: event.target.value || null })}><option value="">—</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select></FormField>
    }
    if (field.fieldType === 'multi_choice') {
      const selected = Array.isArray(value) ? value : []
      return <fieldset className="sub-fieldset" key={field.id}><legend>{field.name}</legend><div className="option-grid">{field.options.map((option) => <label className="check-inline" key={option}><input type="checkbox" checked={selected.includes(option)} onChange={(event) => onChange({ ...values, [field.id]: event.target.checked ? [...selected, option] : selected.filter((item) => item !== option) })} /><span>{option}</span></label>)}</div></fieldset>
    }
    if (field.fieldType === 'number') {
      return <FormField key={field.id} label={field.name}><input type="number" value={typeof value === 'number' ? value : ''} onChange={(event) => onChange({ ...values, [field.id]: event.target.value === '' ? null : Number(event.target.value) })} /></FormField>
    }
    return <FormField key={field.id} label={field.name}><input value={typeof value === 'string' ? value : ''} onChange={(event) => onChange({ ...values, [field.id]: event.target.value || null })} /></FormField>
  })}</fieldset>
}
