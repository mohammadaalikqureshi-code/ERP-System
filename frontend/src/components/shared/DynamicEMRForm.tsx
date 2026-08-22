
import { useForm, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

export type EMRFieldType = 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'switch' | 'date';

export interface EMRFieldSchema {
  id: string;
  label: string;
  type: EMRFieldType;
  required?: boolean;
  options?: { label: string; value: string }[]; // For select
  placeholder?: string;
  defaultValue?: any;
}

interface DynamicEMRFormProps {
  schema: EMRFieldSchema[];
  defaultValues?: any;
  onSubmit: (data: any) => void;
  readOnly?: boolean;
}

export function DynamicEMRForm({ schema, defaultValues = {}, onSubmit, readOnly = false }: DynamicEMRFormProps) {
  const { register, handleSubmit, control, formState: { errors } } = useForm({
    defaultValues: schema.reduce((acc, field) => {
      acc[field.id] = defaultValues[field.id] !== undefined ? defaultValues[field.id] : field.defaultValue || '';
      return acc;
    }, {} as any)
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schema.map((field) => {
          const isError = !!errors[field.id];
          
          return (
            <div key={field.id} className={`space-y-2 ${field.type === 'textarea' ? 'md:col-span-2' : ''}`}>
              <Label htmlFor={field.id} className={isError ? 'text-destructive' : ''}>
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </Label>

              {field.type === 'text' || field.type === 'number' || field.type === 'date' ? (
                <Input
                  id={field.id}
                  type={field.type}
                  placeholder={field.placeholder}
                  {...register(field.id, { required: field.required })}
                  disabled={readOnly}
                />
              ) : field.type === 'textarea' ? (
                <Textarea
                  id={field.id}
                  placeholder={field.placeholder}
                  {...register(field.id, { required: field.required })}
                  disabled={readOnly}
                  className="min-h-[100px]"
                />
              ) : field.type === 'select' ? (
                <Controller
                  control={control}
                  name={field.id}
                  rules={{ required: field.required }}
                  render={({ field: { onChange, value } }) => (
                    <Select onValueChange={onChange} defaultValue={value} disabled={readOnly}>
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder || "Select option"} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : field.type === 'checkbox' ? (
                <div className="flex items-center space-x-2">
                  <Controller
                    control={control}
                    name={field.id}
                    render={({ field: { onChange, value } }) => (
                      <Checkbox
                        id={field.id}
                        checked={value}
                        onCheckedChange={onChange}
                        disabled={readOnly}
                      />
                    )}
                  />
                  <Label htmlFor={field.id}>{field.placeholder || field.label}</Label>
                </div>
              ) : field.type === 'switch' ? (
                <div className="flex items-center justify-between p-2 border rounded-md">
                   <Label htmlFor={field.id}>{field.label}</Label>
                   <Controller
                    control={control}
                    name={field.id}
                    render={({ field: { onChange, value } }) => (
                      <Switch
                        id={field.id}
                        checked={value}
                        onCheckedChange={onChange}
                        disabled={readOnly}
                      />
                    )}
                  />
                </div>
              ) : null}

              {isError && (
                <p className="text-xs text-destructive">This field is required</p>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="flex justify-end pt-4 border-t mt-6">
          <Button type="submit">Save Assessment</Button>
        </div>
      )}
    </form>
  );
}
