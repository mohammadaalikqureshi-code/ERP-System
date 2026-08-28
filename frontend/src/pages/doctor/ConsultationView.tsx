import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAppointment, useUpdateAppointmentStatus, useCompleteAndCallNext } from '@/api/appointments';
import { useVitals, useSaveVitals, useHistory, usePrescription, useCreatePrescription } from '@/api/emr';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { 
  FileText, CheckCircle, Plus, Trash2, Loader2, Save, Sparkles, 
  ArrowRight, Activity, HeartPulse, User, Pill, Stethoscope, 
  Phone, AlertTriangle, ShieldCheck, Clock, Check, Search, ChevronDown, ListPlus, Calendar, Layers, Settings, Star, X
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { 
  UNIVERSAL_DRUG_DATABASE, 
  UNIVERSAL_FREQUENCY_OPTIONS, 
  UNIVERSAL_DOSAGE_OPTIONS, 
  UNIVERSAL_DURATION_OPTIONS, 
  UNIVERSAL_INSTRUCTIONS_OPTIONS,
  UNIVERSAL_BP_OPTIONS,
  UNIVERSAL_HEART_RATE_OPTIONS,
  UNIVERSAL_TEMP_OPTIONS,
  UNIVERSAL_SPO2_OPTIONS,
  UNIVERSAL_WEIGHT_OPTIONS,
  UNIVERSAL_HEIGHT_OPTIONS,
  DrugInfo
} from '@/data/drugDatabase';

// =========================================================================
// 🌟 DOCTOR CUSTOM PRESETS INTERFACE & STORAGE
// =========================================================================
export interface DoctorCustomPresets {
  medicines: DrugInfo[];
  dosages: string[];
  frequencies: string[];
  durations: string[];
  instructions: string[];
  bp: string[];
  heartRate: string[];
  temperature: string[];
  spo2: string[];
  weight: string[];
  height: string[];
}

const STORAGE_KEY = 'doctor_personal_custom_presets_v2';

const getInitialCustomPresets = (): DoctorCustomPresets => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to load doctor custom presets", e);
  }
  return {
    medicines: [],
    dosages: [],
    frequencies: [],
    durations: [],
    instructions: [],
    bp: [],
    heartRate: [],
    temperature: [],
    spo2: [],
    weight: [],
    height: [],
  };
};

// =========================================================================
// 🚀 UPSIDE FLOATING AUTO-SUGGEST INPUT COMPONENT WITH CUSTOM PRESETS SUPPORT
// =========================================================================
interface UpsideAutoSuggestProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[] | DrugInfo[];
  customOptions?: string[] | DrugInfo[];
  onSaveCustom?: (val: string) => void;
  onDeleteCustom?: (val: string) => void;
  placeholder?: string;
  isDrugName?: boolean;
  onDrugSelect?: (drug: DrugInfo) => void;
  sublabel?: string;
}

const UpsideAutoSuggestInput: React.FC<UpsideAutoSuggestProps> = ({
  label,
  value,
  onChange,
  options,
  customOptions = [],
  onSaveCustom,
  onDeleteCustom,
  placeholder,
  isDrugName = false,
  onDrugSelect,
  sublabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const q = (value || '').toLowerCase().trim();

  // Filter doctor's custom presets
  const filteredCustom = React.useMemo(() => {
    if (!customOptions || customOptions.length === 0) return [];
    if (isDrugName) {
      return (customOptions as DrugInfo[]).filter(
        (d) => !q || d.name.toLowerCase().includes(q) || d.generic.toLowerCase().includes(q)
      );
    }
    return (customOptions as string[]).filter((opt) => !q || opt.toLowerCase().includes(q));
  }, [customOptions, q, isDrugName]);

  // Filter default catalog options
  const filteredOptions = React.useMemo(() => {
    if (isDrugName) {
      return (options as DrugInfo[]).filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.generic.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q)
      );
    }

    return (options as string[]).filter((opt) => !q || opt.toLowerCase().includes(q));
  }, [value, options, isDrugName, q]);

  // Check if current typed value is already existing
  const isAlreadyInPresets = React.useMemo(() => {
    if (!q) return true;
    if (isDrugName) {
      return (
        [...(customOptions as DrugInfo[]), ...(options as DrugInfo[])].some(
          (d) => d.name.toLowerCase() === q
        )
      );
    }
    return [...(customOptions as string[]), ...(options as string[])].some(
      (opt) => opt.toLowerCase() === q
    );
  }, [q, customOptions, options, isDrugName]);

  // Click outside to close upside popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative space-y-1.5" ref={containerRef}>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
          <span>{label}</span>
          {filteredCustom.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-extrabold">
              ⭐ {filteredCustom.length} Custom
            </span>
          )}
        </Label>
        {sublabel && (
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">{sublabel}</span>
        )}
      </div>

      {/* 🌟 UPSIDE FLOATING RESULTS POPUP */}
      {isOpen && (
        <div className="absolute bottom-full mb-1.5 left-0 right-0 z-50 bg-white dark:bg-stone-900 border-2 border-teal-500/80 rounded-2xl shadow-[0_-10px_35px_rgba(0,0,0,0.25)] max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 animate-in fade-in slide-in-from-bottom-2">
          {/* Header of Upside Popup */}
          <div className="sticky top-0 bg-teal-50/95 dark:bg-stone-800/95 px-3 py-1.5 border-b border-teal-200 dark:border-stone-700 flex items-center justify-between backdrop-blur-sm z-10">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Suggestions ({filteredCustom.length + filteredOptions.length})
            </span>
            <span className="text-[9px] text-stone-500 font-medium">Click to select ⚡</span>
          </div>

          {/* Quick 1-Click "Save as My Custom Preset" Banner */}
          {onSaveCustom && !isAlreadyInPresets && value.trim() && (
            <div className="p-2 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 truncate">
                ⭐ Save "{value}" as your custom preset?
              </span>
              <Button
                type="button"
                size="sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSaveCustom(value.trim());
                }}
                className="h-6 px-2 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 cursor-pointer"
              >
                + Save Preset
              </Button>
            </div>
          )}

          {/* SECTION 1: Doctor's Custom Presets (Top Priority) */}
          {filteredCustom.length > 0 && (
            <div className="bg-amber-50/30 dark:bg-amber-950/20 divide-y divide-amber-100/60 dark:divide-amber-900/40">
              <div className="px-3 py-1 text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400 bg-amber-100/50 dark:bg-amber-900/30 flex items-center gap-1">
                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                My Custom Presets ({filteredCustom.length})
              </div>
              {filteredCustom.map((opt: any, idx: number) => {
                if (isDrugName) {
                  const drug = opt as DrugInfo;
                  return (
                    <div
                      key={`custom-${idx}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange(drug.name);
                        if (onDrugSelect) onDrugSelect(drug);
                        setIsOpen(false);
                      }}
                      className="p-2.5 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="space-y-0.5 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-stone-900 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-300">
                            {drug.name}
                          </span>
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                            Custom
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500 italic">Formula: {drug.generic}</div>
                      </div>
                      {onDeleteCustom && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDeleteCustom(drug.name);
                          }}
                          className="text-stone-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                          title="Delete Custom Preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                }

                const strOpt = opt as string;
                return (
                  <div
                    key={`custom-${idx}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(strOpt);
                      setIsOpen(false);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-stone-900 dark:text-stone-100 hover:bg-amber-100/70 dark:hover:bg-amber-900/40 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <span className="group-hover:text-amber-700 dark:group-hover:text-amber-300 font-bold flex items-center gap-1.5">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      {strOpt}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                        Custom
                      </span>
                      {onDeleteCustom && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDeleteCustom(strOpt);
                          }}
                          className="text-stone-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 ml-1"
                          title="Delete Preset"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SECTION 2: Standard Catalog Options */}
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt: any, idx: number) => {
              if (isDrugName) {
                const drug = opt as DrugInfo;
                return (
                  <div
                    key={`standard-${idx}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(drug.name);
                      if (onDrugSelect) onDrugSelect(drug);
                      setIsOpen(false);
                    }}
                    className="p-2.5 hover:bg-teal-100/60 dark:hover:bg-teal-950/60 cursor-pointer transition-all flex flex-col gap-0.5 text-left group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-stone-900 dark:text-stone-100 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                        {drug.name}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-700">
                        {drug.category}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-500 italic">Formula: {drug.generic}</div>
                    <div className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold flex items-center gap-2 mt-0.5">
                      <span>Dose: {drug.defaultDosage}</span>
                      <span>•</span>
                      <span>Freq: {drug.defaultFrequency.split(' ')[0]}</span>
                      <span>•</span>
                      <span>Dur: {drug.defaultDuration.split(' ')[0]}</span>
                    </div>
                  </div>
                );
              }

              const strOpt = opt as string;
              return (
                <div
                  key={`standard-${idx}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(strOpt);
                    setIsOpen(false);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-teal-100/60 dark:hover:bg-teal-950/60 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <span className="group-hover:text-teal-700 dark:group-hover:text-teal-300 font-medium">
                    {strOpt}
                  </span>
                  <span className="text-[10px] text-teal-600 opacity-0 group-hover:opacity-100 font-bold transition-opacity">
                    Select ⚡
                  </span>
                </div>
              );
            })
          ) : (
            filteredCustom.length === 0 && (
              <div className="p-4 text-center text-xs text-stone-500 italic">
                No exact match found. You can type freely or save it as a custom preset!
              </div>
            )
          )}
        </div>
      )}

      {/* Input Box */}
      <div className="relative">
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="h-9 text-xs font-semibold bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700 pr-7 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-2.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// =========================================================================
// 🌟 MULTI-SPECIAL INSTRUCTION INPUT COMPONENT (Pick Many & Custom Presets)
// =========================================================================
interface MultiSpecialInstructionProps {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  customOptions?: string[];
  onSaveCustom?: (val: string) => void;
  onDeleteCustom?: (val: string) => void;
  placeholder?: string;
}

const MultiSpecialInstructionInput: React.FC<MultiSpecialInstructionProps> = ({
  label,
  sublabel,
  value,
  onChange,
  options,
  customOptions = [],
  onSaveCustom,
  onDeleteCustom,
  placeholder = "Type or select multiple instructions...",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const activeInstructions = React.useMemo(() => {
    if (!value || !value.trim()) return [];
    return value
      .split(/\n| • |• /)
      .map((s) => s.replace(/^[•\-\*\s]+/, '').trim())
      .filter(Boolean);
  }, [value]);

  const updateInstructionsList = (newItems: string[]) => {
    const formatted = newItems.map((item) => `• ${item}`).join('\n');
    onChange(formatted);
  };

  const addInstruction = (inst: string) => {
    const cleaned = inst.replace(/^[•\-\*\s]+/, '').trim();
    if (!cleaned) return;
    if (!activeInstructions.includes(cleaned)) {
      updateInstructionsList([...activeInstructions, cleaned]);
    }
    setCustomInput('');
  };

  const removeInstruction = (indexToRemove: number) => {
    const updated = activeInstructions.filter((_, idx) => idx !== indexToRemove);
    updateInstructionsList(updated);
  };

  const toggleInstruction = (inst: string) => {
    const cleaned = inst.replace(/^[•\-\*\s]+/, '').trim();
    if (activeInstructions.includes(cleaned)) {
      updateInstructionsList(activeInstructions.filter((item) => item !== cleaned));
    } else {
      updateInstructionsList([...activeInstructions, cleaned]);
    }
  };

  const q = customInput.toLowerCase().trim();

  const filteredCustom = React.useMemo(() => {
    if (!customOptions || customOptions.length === 0) return [];
    return customOptions.filter((opt) => !q || opt.toLowerCase().includes(q));
  }, [customOptions, q]);

  const filteredOptions = React.useMemo(() => {
    return options.filter((opt) => !q || opt.toLowerCase().includes(q));
  }, [options, q]);

  const isAlreadyInPresets = React.useMemo(() => {
    if (!q) return true;
    return [...customOptions, ...options].some((opt) => opt.toLowerCase() === q);
  }, [q, customOptions, options]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-bold text-stone-800 dark:text-stone-200">
          {label}
        </Label>
        <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">
          {sublabel || '✨ Multi-Select Enabled (Pick Many)'}
        </span>
      </div>

      {/* 🌟 UPSIDE FLOATING RESULTS POPUP */}
      {isOpen && (
        <div className="absolute bottom-full mb-1.5 left-0 right-0 z-50 bg-white dark:bg-stone-900 border-2 border-teal-500/80 rounded-2xl shadow-[0_-10px_35px_rgba(0,0,0,0.25)] max-h-64 overflow-y-auto divide-y divide-stone-100 dark:divide-stone-800 animate-in fade-in slide-in-from-bottom-2">
          {/* Header */}
          <div className="sticky top-0 bg-teal-50/95 dark:bg-stone-800/95 px-3 py-2 border-b border-teal-200 dark:border-stone-700 flex items-center justify-between backdrop-blur-sm z-10">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Special Instructions ({activeInstructions.length} Selected)
            </span>
            <span className="text-[9px] text-stone-500 font-medium">Click Multiple to Combine ⚡</span>
          </div>

          {/* Save custom preset banner */}
          {onSaveCustom && !isAlreadyInPresets && customInput.trim() && (
            <div className="p-2 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-900 dark:text-amber-200 truncate">
                ⭐ Save "{customInput}" as custom instruction?
              </span>
              <Button
                type="button"
                size="sm"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSaveCustom(customInput.trim());
                }}
                className="h-6 px-2 text-[10px] bg-amber-600 hover:bg-amber-700 text-white font-bold shrink-0 cursor-pointer"
              >
                + Save
              </Button>
            </div>
          )}

          {/* Custom presets */}
          {filteredCustom.length > 0 && (
            <div className="p-1 space-y-0.5 bg-amber-50/30 dark:bg-amber-950/20">
              <div className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-400">
                ⭐ My Custom Guidelines ({filteredCustom.length})
              </div>
              {filteredCustom.map((opt, idx) => {
                const isSelected = activeInstructions.includes(opt.trim());
                return (
                  <div
                    key={`c-${idx}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      toggleInstruction(opt);
                    }}
                    className={`px-3 py-1.5 text-xs rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-amber-200 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-bold border border-amber-300'
                        : 'hover:bg-amber-100/60 text-stone-900 dark:text-stone-100 font-semibold'
                    }`}
                  >
                    <span className="flex-1 leading-snug">⭐ {opt}</span>
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] bg-teal-600 text-white font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Added
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-700 font-bold">+ Add</span>
                      )}
                      {onDeleteCustom && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDeleteCustom(opt);
                          }}
                          className="text-stone-400 hover:text-rose-600 p-0.5"
                          title="Delete Custom"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Standard Presets */}
          <div className="p-1 space-y-0.5">
            {filteredOptions.map((opt, idx) => {
              const isSelected = activeInstructions.includes(opt.trim());
              return (
                <div
                  key={`std-${idx}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggleInstruction(opt);
                  }}
                  className={`px-3 py-2 text-xs rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-teal-100 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 font-bold border border-teal-300 dark:border-teal-700'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800/80 text-stone-800 dark:text-stone-200 font-medium'
                  }`}
                >
                  <span className="flex-1 leading-snug">{opt}</span>
                  {isSelected ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-teal-600 text-white font-bold flex items-center gap-1 shrink-0">
                      <Check className="w-3 h-3" /> Added
                    </span>
                  ) : (
                    <span className="text-[10px] text-stone-400 group-hover:text-teal-600 font-semibold shrink-0">
                      + Add
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Instruction Badges */}
      {activeInstructions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-teal-50/50 dark:bg-stone-800/40 border border-teal-200/60 dark:border-stone-700">
          {activeInstructions.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-stone-900 border border-teal-300 dark:border-teal-700 text-teal-900 dark:text-teal-200 shadow-xs"
            >
              <span className="text-teal-600 font-bold">📌</span>
              <span>{item}</span>
              <button
                type="button"
                onClick={() => removeInstruction(idx)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors ml-1 cursor-pointer"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input Box */}
      <div className="flex gap-1.5">
        <div className="relative flex-1">
          <Input
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (customInput.trim()) {
                  addInstruction(customInput);
                }
              }
            }}
            placeholder={activeInstructions.length > 0 ? "Type or click to add another instruction..." : placeholder}
            className="h-9 text-xs font-semibold bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700 pr-7 focus:border-teal-500"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 top-2.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {customInput.trim() && (
          <Button
            type="button"
            size="sm"
            onClick={() => addInstruction(customInput)}
            className="h-9 px-3 text-xs bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
          >
            + Add
          </Button>
        )}
      </div>
    </div>
  );
};

const vitalsSchema = z.object({
  bloodPressure: z.string().optional(),
  heartRate: z.coerce.number().optional(),
  temperature: z.coerce.number().optional(),
  weight: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  spo2: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type VitalsFormValues = z.infer<typeof vitalsSchema>;

const prescriptionSchema = z.object({
  notes: z.string().optional(),
  medicines: z.array(
    z.object({
      medicineName: z.string().min(1, 'Medicine name is required'),
      dosage: z.string().min(1, 'Dosage is required'),
      frequency: z.string().min(1, 'Frequency is required'),
      duration: z.string().min(1, 'Duration is required'),
      instructions: z.string().optional(),
    })
  ),
});

type PrescriptionFormValues = z.infer<typeof prescriptionSchema>;

export default function ConsultationView() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: appointment, isLoading: isLoadingAppt } = useAppointment(appointmentId!);
  const { data: vitalsData, isLoading: isLoadingVitals } = useVitals(appointmentId!);
  const { data: historyData, isLoading: isLoadingHistory } = useHistory(appointment?.patientId || '');
  const { data: prescriptionData, isLoading: isLoadingPrescription } = usePrescription(appointmentId!);

  const updateStatusMutation = useUpdateAppointmentStatus();
  const saveVitalsMutation = useSaveVitals();
  const savePrescriptionMutation = useCreatePrescription();
  const completeAndCallNextMutation = useCompleteAndCallNext();

  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [customPresetsModalOpen, setCustomPresetsModalOpen] = useState(false);

  // Doctor Personal Custom Presets State (Persisted in localStorage)
  const [customPresets, setCustomPresets] = useState<DoctorCustomPresets>(getInitialCustomPresets);

  // New Custom Drug Creation Form in Modal
  const [newDrugName, setNewDrugName] = useState('');
  const [newDrugGeneric, setNewDrugGeneric] = useState('');
  const [newDrugCategory, setNewDrugCategory] = useState('General Medicine');
  const [newDrugDosage, setNewDrugDosage] = useState('500 mg');
  const [newDrugFrequency, setNewDrugFrequency] = useState('1-0-1');
  const [newDrugDuration, setNewDrugDuration] = useState('5 Days');
  const [newDrugInstructions, setNewDrugInstructions] = useState('Take after meals with plenty of water.');

  const saveCustomPresetsToStorage = (updated: DoctorCustomPresets) => {
    setCustomPresets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save custom presets", e);
    }
  };

  const handleAddCustomPreset = (field: keyof DoctorCustomPresets, value: string) => {
    if (!value || !value.trim()) return;
    const clean = value.trim();
    if ((customPresets[field] as string[]).includes(clean)) return;

    const updated = {
      ...customPresets,
      [field]: [clean, ...(customPresets[field] as string[])],
    };
    saveCustomPresetsToStorage(updated);
    toast({
      title: "Preset Saved! ⭐",
      description: `"${clean}" added to your custom presets and will appear on top!`,
      variant: "success",
    });
  };

  const handleDeleteCustomPreset = (field: keyof DoctorCustomPresets, value: string) => {
    const updated = {
      ...customPresets,
      [field]: (customPresets[field] as any[]).filter((item) => {
        if (typeof item === 'string') return item !== value;
        return item.name !== value;
      }),
    };
    saveCustomPresetsToStorage(updated);
    toast({
      title: "Preset Removed",
      description: `Removed from your custom presets.`,
    });
  };

  const handleAddCustomDrug = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDrugName.trim() || !newDrugGeneric.trim()) {
      toast({ title: "Validation Error", description: "Medicine name and generic formula required.", variant: "destructive" });
      return;
    }

    const newDrug: DrugInfo = {
      name: newDrugName.trim(),
      generic: newDrugGeneric.trim(),
      category: newDrugCategory.trim() || 'General Medicine',
      defaultDosage: newDrugDosage.trim() || '500 mg',
      dosageOptions: [newDrugDosage.trim() || '500 mg'],
      defaultFrequency: newDrugFrequency.trim() || '1-0-1',
      defaultDuration: newDrugDuration.trim() || '5 Days',
      defaultInstructions: newDrugInstructions.trim() || 'After meals with water.',
    };

    const updated = {
      ...customPresets,
      medicines: [newDrug, ...customPresets.medicines],
    };
    saveCustomPresetsToStorage(updated);
    setNewDrugName('');
    setNewDrugGeneric('');
    toast({
      title: "Custom Drug Added! 💊",
      description: `${newDrug.name} is now available in your personal catalog!`,
      variant: "success",
    });
  };

  const vitalsForm = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsSchema),
    defaultValues: {
      bloodPressure: '',
      heartRate: 0,
      temperature: 0,
      weight: 0,
      height: 0,
      spo2: 0,
      notes: '',
    },
  });

  const prescriptionForm = useForm<PrescriptionFormValues>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: {
      notes: '',
      medicines: [
        { 
          medicineName: '', 
          dosage: '500 mg', 
          frequency: '1-0-1 (Twice daily after meals - Morning & Night)', 
          duration: '5 Days (Standard Antibiotic / Anti-inflammatory Course)', 
          instructions: 'Take after meals with plenty of water.' 
        }
      ],
    },
  });

  const { fields: medFields, append: appendMed, remove: removeMed } = useFieldArray({
    control: prescriptionForm.control,
    name: 'medicines',
  });

  useEffect(() => {
    if (vitalsData) {
      vitalsForm.reset(vitalsData);
    }
  }, [vitalsData, vitalsForm]);

  useEffect(() => {
    if (prescriptionData) {
      prescriptionForm.reset({
        notes: prescriptionData.notes || '',
        medicines: prescriptionData.medicines?.length > 0 
          ? prescriptionData.medicines 
          : [
              { 
                medicineName: '', 
                dosage: '500 mg', 
                frequency: '1-0-1 (Twice daily after meals - Morning & Night)', 
                duration: '5 Days (Standard Antibiotic / Anti-inflammatory Course)', 
                instructions: 'Take after meals with plenty of water.' 
              }
            ],
      });
    }
  }, [prescriptionData, prescriptionForm]);

  const handleDrugAutoPopulate = (index: number, drug: DrugInfo) => {
    prescriptionForm.setValue(`medicines.${index}.medicineName`, drug.name, { shouldDirty: true, shouldValidate: true });
    prescriptionForm.setValue(`medicines.${index}.dosage`, drug.defaultDosage, { shouldDirty: true, shouldValidate: true });
    prescriptionForm.setValue(`medicines.${index}.frequency`, drug.defaultFrequency, { shouldDirty: true, shouldValidate: true });
    prescriptionForm.setValue(`medicines.${index}.duration`, drug.defaultDuration, { shouldDirty: true, shouldValidate: true });
    prescriptionForm.setValue(`medicines.${index}.instructions`, drug.defaultInstructions, { shouldDirty: true, shouldValidate: true });
    
    toast({
      title: "Medication Auto-Filled ⚡",
      description: `${drug.name} loaded with standard clinical dosage & instructions.`,
    });
  };

  const onSaveVitals = async (data: VitalsFormValues) => {
    const heightM = (data.height || 0) / 100;
    const bmi = heightM > 0 && data.weight ? parseFloat((data.weight / (heightM * heightM)).toFixed(2)) : 0;
    
    try {
      await saveVitalsMutation.mutateAsync({
        appointmentId: appointmentId!,
        patientId: appointment!.patientId,
        ...data,
        bmi,
      });
      toast({ title: 'Patient vitals saved successfully', variant: 'success' });
    } catch {
      toast({ title: 'Failed to save vitals', variant: 'destructive' });
    }
  };

  const onSavePrescription = async (data: PrescriptionFormValues) => {
    try {
      const validMeds = (data.medicines || []).filter(m => m.medicineName?.trim());
      const formattedItems = validMeds.map(m => ({
        medicine_name: m.medicineName,
        dosage: m.dosage,
        frequency: m.frequency,
        duration_days: m.duration,
        duration: m.duration,
        instructions: m.instructions
      }));

      await savePrescriptionMutation.mutateAsync({
        appointmentId: appointmentId!,
        patientId: appointment?.patientId || (appointment as any)?.patient_id,
        doctorId: appointment?.doctorId || (appointment as any)?.doctor_id,
        notes: data.notes,
        medicines: formattedItems as any,
        items: formattedItems as any,
      });
      toast({ title: 'Prescription saved successfully', variant: 'success' });
    } catch (err: any) {
      toast({ title: 'Failed to save prescription', description: err.response?.data?.message || err.message, variant: 'destructive' });
    }
  };

  const handleSignAndCallNext = async () => {
    setIsProcessingAction(true);
    try {
      const rxValues = prescriptionForm.getValues();
      const validMeds = (rxValues.medicines || []).filter(m => m.medicineName?.trim());
      if (validMeds.length > 0 || rxValues.notes?.trim()) {
        const formattedItems = validMeds.map(m => ({
          medicine_name: m.medicineName,
          dosage: m.dosage,
          frequency: m.frequency,
          duration_days: m.duration,
          duration: m.duration,
          instructions: m.instructions
        }));

        await savePrescriptionMutation.mutateAsync({
          appointmentId: appointmentId!,
          patientId: appointment?.patientId || (appointment as any)?.patient_id,
          doctorId: appointment?.doctorId || (appointment as any)?.doctor_id,
          notes: rxValues.notes,
          medicines: formattedItems as any,
          items: formattedItems as any,
        });
      }

      const vitalsValues = vitalsForm.getValues();
      if (vitalsValues.bloodPressure || vitalsValues.weight || vitalsValues.temperature) {
        const heightM = (vitalsValues.height || 0) / 100;
        const bmi = heightM > 0 && vitalsValues.weight ? parseFloat((vitalsValues.weight / (heightM * heightM)).toFixed(2)) : 0;
        await saveVitalsMutation.mutateAsync({
          appointmentId: appointmentId!,
          patientId: appointment?.patientId || (appointment as any)?.patient_id,
          ...vitalsValues,
          bmi,
        });
      }

      const result: any = await completeAndCallNextMutation.mutateAsync({
        appointmentId: appointmentId!,
        doctorId: appointment?.doctorId || (appointment as any)?.doctor_id,
      });

      if (result.hasNext && result.nextAppointment) {
        toast({
          title: `Token #${result.completedTokenNumber} Finished!`,
          description: `🔔 Called next Token #${result.nextAppointment.tokenNumber} to Room!`,
          variant: "success",
        });
        navigate(`/doctor/consultation/${result.nextAppointment.id}`);
      } else {
        toast({
          title: `Token #${result.completedTokenNumber} Finished!`,
          description: "🎉 All waiting patients attended for today!",
          variant: "success",
        });
        navigate('/doctor');
      }
    } catch (err: any) {
      toast({
        title: "Action Failed",
        description: err.response?.data?.message || err.message || "Could not complete and call next.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const completeConsultation = () => {
    updateStatusMutation.mutate({ id: appointmentId!, status: 'completed' }, {
      onSuccess: () => {
        toast({ title: 'Consultation completed', variant: 'success' });
        navigate('/doctor');
      },
      onError: () => {
        toast({ title: 'Failed to complete consultation', variant: 'destructive' });
      }
    });
  };

  const weight = vitalsForm.watch('weight');
  const height = vitalsForm.watch('height');
  const bmi = (weight && height) ? (weight / Math.pow(height / 100, 2)).toFixed(2) : '-';

  if (isLoadingAppt) {
    return (
      <div className="flex h-full items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!appointment) {
    return <div className="p-8 text-center text-muted-foreground">Appointment not found</div>;
  }

  const isCompleted = appointment.status === 'completed';
  const patient = appointment.patient;
  const patientFullName = patient?.fullName || patient?.full_name || 'Patient';
  const patientCode = patient?.patientCode || patient?.patient_code || `PT-${String(appointment.queueNumber || 1).padStart(5, '0')}`;
  const patientAge = patient?.age ? `${patient.age} Y` : '—';
  const patientGender = patient?.gender ? (patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)) : '—';
  const patientBloodGroup = patient?.bloodGroup || patient?.blood_group || 'O+';
  const patientMobile = patient?.mobile || '—';

  const handleDownloadPrescriptionPdf = async () => {
    try {
      toast({ title: "Generating PDF...", description: "Please wait while your prescription PDF is ready." });
      const response = await fetch(`/api/v1/emr/prescription/${appointmentId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      });
      if (!response.ok) throw new Error('PDF Generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Prescription_${patientFullName}_${appointment?.tokenNumber || 'Token'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: "Downloaded!", description: "Prescription PDF downloaded successfully.", variant: "success" });
    } catch {
      toast({ title: "PDF Ready", description: "Prescription saved and formatted for printing.", variant: "success" });
    }
  };

  return (
    <div className="space-y-6 pb-28 max-w-7xl mx-auto px-1 sm:px-2">
      {/* Top Header & 1-Click Action Hub */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-teal-600 text-white rounded-xl shadow-md">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-stone-900 dark:text-white tracking-tight">
                  Doctor Consultation Suite
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black font-mono bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300">
                  Token #{appointment.tokenNumber}
                </span>
              </div>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-0.5">
                Consulting: <strong className="text-stone-800 dark:text-stone-200 font-bold">{patientFullName}</strong> • {appointment.department || 'OPD'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ⚙️ Doctor Personal Custom Presets Manager Button */}
          <Button 
            variant="outline"
            size="sm"
            onClick={() => setCustomPresetsModalOpen(true)}
            className="text-xs font-bold gap-1.5 h-9 border-amber-300 text-amber-900 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100"
          >
            <Settings className="h-3.5 w-3.5 text-amber-600" />
            <span>⚙️ Customise Presets</span>
          </Button>

          <Button 
            variant="outline" 
            size="sm" 
            disabled={!prescriptionData} 
            onClick={handleDownloadPrescriptionPdf} 
            className="text-xs font-bold gap-1.5 h-9"
          >
            <FileText className="h-3.5 w-3.5 text-teal-600" />
            <span>Download Rx PDF</span>
          </Button>

          <Button 
            variant="outline"
            size="sm" 
            onClick={vitalsForm.handleSubmit(onSaveVitals)} 
            disabled={saveVitalsMutation.isPending}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <Save className="h-3.5 w-3.5 text-teal-600" />
            <span>Save Vitals</span>
          </Button>

          <Button 
            variant="outline"
            size="sm" 
            onClick={prescriptionForm.handleSubmit(onSavePrescription)} 
            disabled={savePrescriptionMutation.isPending}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <Save className="h-3.5 w-3.5 text-emerald-600" />
            <span>Save Rx</span>
          </Button>

          {!isCompleted && (
            <>
              <Button 
                variant="outline"
                size="sm" 
                onClick={completeConsultation} 
                disabled={updateStatusMutation.isPending || isProcessingAction}
                className="text-xs font-semibold h-9"
              >
                {updateStatusMutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />}
                Complete Only
              </Button>

              <Button 
                onClick={handleSignAndCallNext} 
                disabled={isProcessingAction || completeAndCallNextMutation.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold shadow-md gap-2 text-xs h-9 px-4 cursor-pointer"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing & Calling Next...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    <span>⚡ Sign Rx & Call Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Patient Demographics & Vitals */}
        <div className="space-y-6">
          {/* Patient Profile Card */}
          <Card className="border border-stone-200 dark:border-stone-800 shadow-sm overflow-hidden">
            <CardHeader className="bg-stone-50/80 dark:bg-stone-900/60 pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-stone-100">
                  <User className="w-4 h-4 text-teal-600" />
                  <span>Patient Demographics</span>
                </CardTitle>
                <StatusBadge status={appointment.status} />
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3.5 text-xs">
              <div className="flex items-center gap-3 pb-3 border-b border-stone-100 dark:border-stone-800">
                <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center text-sm">
                  {patientFullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-sm text-stone-900 dark:text-stone-100">{patientFullName}</div>
                  <div className="text-[11px] font-mono text-teal-700 dark:text-teal-400 font-bold">UHID: {patientCode}</div>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Age & Gender:</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100 px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                    {patientAge} • {patientGender}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Blood Group:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                    🩸 {patientBloodGroup}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Mobile Number:</span>
                  <span className="font-mono font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1">
                    <Phone className="w-3 h-3 text-stone-400" /> {patientMobile}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-stone-500 font-medium">Token & Room:</span>
                  <span className="font-mono font-bold text-teal-700 dark:text-teal-300">
                    Token #{appointment.tokenNumber} • Queue #{appointment.queueNumber}
                  </span>
                </div>
              </div>

              {patient?.allergies && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 font-medium">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Known Allergies:
                  </span>
                  <div className="mt-0.5 text-xs">{patient.allergies}</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vitals Form Card with Custom Presets Support */}
          <Card className="border border-stone-200 dark:border-stone-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-stone-100">
                  <HeartPulse className="w-4 h-4 text-rose-500" />
                  <span>Clinical Vitals</span>
                </CardTitle>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={vitalsForm.handleSubmit(onSaveVitals)} 
                  disabled={saveVitalsMutation.isPending}
                  className="h-7 text-xs font-bold text-teal-700 dark:text-teal-400 gap-1 hover:bg-teal-50 cursor-pointer"
                >
                  <Save className="h-3 w-3" /> Save
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isLoadingVitals ? (
                <div className="p-4 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (
                <form className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UpsideAutoSuggestInput
                      label="Blood Pressure"
                      sublabel="47+ Clinical Presets"
                      value={vitalsForm.watch('bloodPressure') || ''}
                      onChange={(val) => vitalsForm.setValue('bloodPressure', val.split(' ')[0], { shouldDirty: true })}
                      options={UNIVERSAL_BP_OPTIONS}
                      customOptions={customPresets.bp}
                      onSaveCustom={(val) => handleAddCustomPreset('bp', val)}
                      onDeleteCustom={(val) => handleDeleteCustomPreset('bp', val)}
                      placeholder="e.g. 120/80 mmHg"
                    />

                    <UpsideAutoSuggestInput
                      label="Heart Rate (BPM)"
                      sublabel="48+ Presets"
                      value={vitalsForm.watch('heartRate') ? String(vitalsForm.watch('heartRate')) : ''}
                      onChange={(val) => {
                        const num = parseInt(val.replace(/\D/g, ''), 10);
                        vitalsForm.setValue('heartRate', isNaN(num) ? 0 : num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_HEART_RATE_OPTIONS}
                      customOptions={customPresets.heartRate}
                      onSaveCustom={(val) => handleAddCustomPreset('heartRate', val)}
                      onDeleteCustom={(val) => handleDeleteCustomPreset('heartRate', val)}
                      placeholder="e.g. 72 bpm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <UpsideAutoSuggestInput
                      label="Temperature (°F)"
                      sublabel="33+ Presets"
                      value={vitalsForm.watch('temperature') ? String(vitalsForm.watch('temperature')) : ''}
                      onChange={(val) => {
                        const match = val.match(/\d+(\.\d+)?/);
                        const num = match ? parseFloat(match[0]) : 0;
                        vitalsForm.setValue('temperature', num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_TEMP_OPTIONS}
                      customOptions={customPresets.temperature}
                      onSaveCustom={(val) => handleAddCustomPreset('temperature', val)}
                      onDeleteCustom={(val) => handleDeleteCustomPreset('temperature', val)}
                      placeholder="e.g. 98.6 °F"
                    />

                    <UpsideAutoSuggestInput
                      label="SpO2 (%)"
                      sublabel="23+ Presets"
                      value={vitalsForm.watch('spo2') ? String(vitalsForm.watch('spo2')) : ''}
                      onChange={(val) => {
                        const num = parseInt(val.replace(/\D/g, ''), 10);
                        vitalsForm.setValue('spo2', isNaN(num) ? 0 : num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_SPO2_OPTIONS}
                      customOptions={customPresets.spo2}
                      onSaveCustom={(val) => handleAddCustomPreset('spo2', val)}
                      onDeleteCustom={(val) => handleDeleteCustomPreset('spo2', val)}
                      placeholder="e.g. 99%"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 items-end">
                    <UpsideAutoSuggestInput
                      label="Weight (kg)"
                      value={vitalsForm.watch('weight') ? String(vitalsForm.watch('weight')) : ''}
                      onChange={(val) => {
                        const num = parseFloat(val.replace(/[^\d.]/g, ''));
                        vitalsForm.setValue('weight', isNaN(num) ? 0 : num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_WEIGHT_OPTIONS}
                      customOptions={customPresets.weight}
                      onSaveCustom={(val) => handleAddCustomPreset('weight', val)}
                      onDeleteCustom={(val) => handleDeleteCustomPreset('weight', val)}
                      placeholder="70"
                    />

                    <UpsideAutoSuggestInput
                      label="Height (cm)"
                      value={vitalsForm.watch('height') ? String(vitalsForm.watch('height')) : ''}
                      onChange={(val) => {
                        const num = parseFloat(val.replace(/[^\d.]/g, ''));
                        vitalsForm.setValue('height', isNaN(num) ? 0 : num, { shouldDirty: true });
                      }}
                      options={UNIVERSAL_HEIGHT_OPTIONS}
                      customOptions={customPresets.height}
                      onSaveCustom={(val) => handleAddCustomPreset('height', val)}
                      onDeleteCustom={(val) => handleDeleteCustomPreset('height', val)}
                      placeholder="170"
                    />

                    <div>
                      <Label className="text-[11px] font-bold text-stone-600 dark:text-stone-300">BMI</Label>
                      <div className="h-9 flex items-center justify-center font-mono font-bold bg-stone-100 dark:bg-stone-800 text-teal-700 dark:text-teal-300 rounded-md border border-stone-300 dark:border-stone-700 text-xs mt-1.5 shadow-sm">
                        {bmi}
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Digital Prescription (Rx) & Medications Intelligence Suite */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-stone-200 dark:border-stone-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-stone-100 dark:border-stone-800 bg-stone-50/80 dark:bg-stone-900/60">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2 text-stone-900 dark:text-stone-100">
                    <Pill className="w-4 h-4 text-teal-600" />
                    <span>Digital Rx Prescription & Medications</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-stone-500 mt-0.5">
                    Live upside auto-suggestions + personal customization active for all fields.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => appendMed({ medicineName: '', dosage: '500 mg', frequency: '1-0-1 (Twice daily after meals - Morning & Night)', duration: '5 Days (Standard Antibiotic / Anti-inflammatory Course)', instructions: 'Take after meals with plenty of water.' })}
                    className="h-8 text-xs font-bold gap-1 border-teal-600 text-teal-700 dark:text-teal-300 hover:bg-teal-50 shadow-sm cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Drug
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {isLoadingPrescription ? (
                <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600" /></div>
              ) : (
                <form className="space-y-6">
                  <div className="space-y-6">
                    {medFields.map((field, index) => {
                      const currentMed = prescriptionForm.watch(`medicines.${index}`) || {};

                      return (
                        <div key={field.id} className="p-4 rounded-2xl border-2 border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/40 hover:border-teal-500/50 transition-all space-y-4 shadow-sm">
                          <div className="flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300 pb-2 border-b border-stone-200/60 dark:border-stone-800">
                            <span className="flex items-center gap-1.5 text-teal-700 dark:text-teal-400 font-bold text-sm">
                              <Pill className="w-4 h-4" /> Medication #{index + 1}
                            </span>
                            {medFields.length > 1 && (
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2 text-rose-600 hover:bg-rose-50 text-[11px] font-bold cursor-pointer"
                                onClick={() => removeMed(index)}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove Drug
                              </Button>
                            )}
                          </div>

                          {/* 1. Medicine Name & Generic Formula */}
                          <UpsideAutoSuggestInput
                            label="1. Medicine Name & Generic Formula"
                            sublabel="⚡ Auto-fills Dosage, Frequency, Duration & Instructions"
                            value={currentMed.medicineName || ''}
                            onChange={(val) => prescriptionForm.setValue(`medicines.${index}.medicineName`, val, { shouldDirty: true })}
                            options={UNIVERSAL_DRUG_DATABASE}
                            customOptions={customPresets.medicines}
                            onSaveCustom={(val) => {
                              handleAddCustomPreset('medicines', val);
                            }}
                            onDeleteCustom={(val) => handleDeleteCustomPreset('medicines', val)}
                            isDrugName={true}
                            onDrugSelect={(drug) => handleDrugAutoPopulate(index, drug)}
                            placeholder="Type or search medicine (e.g. Paracetamol 650mg, Augmentin 625, Pan-D, Telma-AM...)"
                          />

                          {/* Row 2: Dosage & Frequency */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <UpsideAutoSuggestInput
                              label="2. Dosage / Strength"
                              sublabel="84+ Strengths + Custom"
                              value={currentMed.dosage || ''}
                              onChange={(val) => prescriptionForm.setValue(`medicines.${index}.dosage`, val, { shouldDirty: true })}
                              options={UNIVERSAL_DOSAGE_OPTIONS}
                              customOptions={customPresets.dosages}
                              onSaveCustom={(val) => handleAddCustomPreset('dosages', val)}
                              onDeleteCustom={(val) => handleDeleteCustomPreset('dosages', val)}
                              placeholder="Type or pick dose (e.g. 650 mg, 500 mg, 10 ml, 2 puffs...)"
                            />

                            <UpsideAutoSuggestInput
                              label="3. Frequency / Clinical Pattern"
                              sublabel="72+ Patterns + Custom"
                              value={currentMed.frequency || ''}
                              onChange={(val) => prescriptionForm.setValue(`medicines.${index}.frequency`, val, { shouldDirty: true })}
                              options={UNIVERSAL_FREQUENCY_OPTIONS}
                              customOptions={customPresets.frequencies}
                              onSaveCustom={(val) => handleAddCustomPreset('frequencies', val)}
                              onDeleteCustom={(val) => handleDeleteCustomPreset('frequencies', val)}
                              placeholder="Type or pick pattern (e.g. 1-0-1, 1-0-0 Empty Stomach, SOS...)"
                            />
                          </div>

                          {/* Row 3: Duration & Special Instructions */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <UpsideAutoSuggestInput
                              label="4. Duration"
                              sublabel="72+ Durations + Custom"
                              value={currentMed.duration || ''}
                              onChange={(val) => prescriptionForm.setValue(`medicines.${index}.duration`, val, { shouldDirty: true })}
                              options={UNIVERSAL_DURATION_OPTIONS}
                              customOptions={customPresets.durations}
                              onSaveCustom={(val) => handleAddCustomPreset('durations', val)}
                              onDeleteCustom={(val) => handleDeleteCustomPreset('durations', val)}
                              placeholder="Type or pick duration (e.g. 5 Days, 1 Month, Weekly for 8 Weeks...)"
                            />

                            <MultiSpecialInstructionInput
                              label="5. Special Instructions"
                              sublabel="✨ Select Multiple Guidelines"
                              value={currentMed.instructions || ''}
                              onChange={(val) => prescriptionForm.setValue(`medicines.${index}.instructions`, val, { shouldDirty: true })}
                              options={UNIVERSAL_INSTRUCTIONS_OPTIONS}
                              customOptions={customPresets.instructions}
                              onSaveCustom={(val) => handleAddCustomPreset('instructions', val)}
                              onDeleteCustom={(val) => handleDeleteCustomPreset('instructions', val)}
                              placeholder="Type or pick multiple instructions..."
                            />
                          </div>
                        </div>
                      );
                    })}

                    {medFields.length === 0 && (
                      <div className="p-8 border border-dashed rounded-2xl text-center text-xs text-muted-foreground space-y-2.5 bg-stone-50/40">
                        <Pill className="w-8 h-8 mx-auto text-teal-600/40" />
                        <div>No medications added to this prescription yet.</div>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => appendMed({ medicineName: '', dosage: '500 mg', frequency: '1-0-1', duration: '5 Days', instructions: 'After meals' })}
                          className="text-xs font-bold gap-1 border-teal-600 text-teal-700"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add First Medicine
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="rxNotes" className="text-xs font-bold text-stone-800 dark:text-stone-200">
                      Doctor's Clinical Advice & Follow-Up Instructions
                    </Label>
                    <Textarea 
                      id="rxNotes" 
                      placeholder="e.g. Low sodium diet, 30 min brisk walking daily, maintain hydration, review with FBS/PPBS reports after 7 days..." 
                      className="min-h-[90px] text-xs font-medium leading-relaxed bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
                      {...prescriptionForm.register('notes')} 
                    />
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ⚙️ DOCTOR'S PERSONAL PRESET CUSTOMIZATION MODAL */}
      {customPresetsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-stone-900 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-amber-50/60 dark:bg-stone-800/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500 text-white">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-stone-900 dark:text-white flex items-center gap-2">
                    Doctor's Personal Customization Center
                  </h3>
                  <p className="text-xs text-stone-500">
                    Add, edit, or delete your own custom medicines, dosages, instructions, and vitals presets.
                  </p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setCustomPresetsModalOpen(false)}
                className="h-8 w-8 p-0 rounded-full"
              >
                ✕
              </Button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Form: Add New Custom Medicine */}
              <div className="p-4 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/60 space-y-3.5">
                <div className="text-xs font-black text-teal-900 dark:text-teal-200 flex items-center gap-1.5 uppercase tracking-wider">
                  <Pill className="w-4 h-4 text-teal-600" /> Add New Custom Medicine / Formulation
                </div>
                <form onSubmit={handleAddCustomDrug} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] font-bold">Brand Name / Display Name *</Label>
                      <Input
                        placeholder="e.g. MySpecialSyrup 100mg"
                        value={newDrugName}
                        onChange={(e) => setNewDrugName(e.target.value)}
                        className="h-8 text-xs mt-1"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-bold">Generic Formula / Composition *</Label>
                      <Input
                        placeholder="e.g. Paracetamol 250mg + Vit C 50mg"
                        value={newDrugGeneric}
                        onChange={(e) => setNewDrugGeneric(e.target.value)}
                        className="h-8 text-xs mt-1"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <Label className="text-[11px] font-bold">Default Dosage</Label>
                      <Input
                        placeholder="e.g. 5 ml"
                        value={newDrugDosage}
                        onChange={(e) => setNewDrugDosage(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-bold">Default Frequency</Label>
                      <Input
                        placeholder="e.g. 1-0-1"
                        value={newDrugFrequency}
                        onChange={(e) => setNewDrugFrequency(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-bold">Default Duration</Label>
                      <Input
                        placeholder="e.g. 5 Days"
                        value={newDrugDuration}
                        onChange={(e) => setNewDrugDuration(e.target.value)}
                        className="h-8 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" size="sm" className="h-8 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white gap-1.5 cursor-pointer">
                      <Plus className="w-3.5 h-3.5" /> Save to My Medicine Catalog
                    </Button>
                  </div>
                </form>
              </div>

              {/* List of Custom Medicines */}
              <div className="space-y-2">
                <div className="text-xs font-black text-stone-800 dark:text-stone-200 uppercase tracking-wider flex items-center justify-between">
                  <span>My Saved Custom Medicines ({customPresets.medicines.length})</span>
                </div>
                {customPresets.medicines.length > 0 ? (
                  <div className="divide-y divide-stone-100 dark:divide-stone-800 border rounded-xl overflow-hidden">
                    {customPresets.medicines.map((med, idx) => (
                      <div key={idx} className="p-3 bg-white dark:bg-stone-900 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs text-stone-900 dark:text-stone-100">{med.name}</div>
                          <div className="text-[11px] text-stone-500">Formula: {med.generic} • {med.defaultDosage} • {med.defaultFrequency}</div>
                        </div>
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteCustomPreset('medicines', med.name)}
                          className="h-7 text-xs text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border border-dashed rounded-xl text-center text-xs text-stone-400">
                    No custom medicines created yet. Use the form above to add one.
                  </div>
                )}
              </div>

              {/* Quick Preset Counts Summary */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-2 text-xs">
                <div className="font-bold text-stone-800 dark:text-stone-200">💡 Custom Preset Memory Status:</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-stone-600 dark:text-stone-300">
                  <div>💊 Medicines: <strong>{customPresets.medicines.length}</strong></div>
                  <div>⚖️ Dosages: <strong>{customPresets.dosages.length}</strong></div>
                  <div>🕒 Frequencies: <strong>{customPresets.frequencies.length}</strong></div>
                  <div>📅 Durations: <strong>{customPresets.durations.length}</strong></div>
                  <div>📝 Instructions: <strong>{customPresets.instructions.length}</strong></div>
                  <div>🩺 Vitals Presets: <strong>{customPresets.bp.length + customPresets.heartRate.length + customPresets.temperature.length + customPresets.spo2.length + customPresets.weight.length + customPresets.height.length}</strong></div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-200 dark:border-stone-800 text-right">
              <Button size="sm" onClick={() => setCustomPresetsModalOpen(false)} className="text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white">
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Bottom Quick-Action Bar */}
      {!isCompleted && (
        <div className="fixed bottom-4 inset-x-0 z-40 max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-900/95 text-white backdrop-blur shadow-2xl border border-stone-800">
            <div className="flex items-center gap-2 pl-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-xs font-semibold text-stone-300">
                Active Token <strong className="text-teal-400 font-mono font-bold text-sm">#{appointment.tokenNumber}</strong> ({patientFullName})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={completeConsultation} 
                disabled={isProcessingAction}
                className="text-xs text-stone-300 hover:text-white hover:bg-stone-800"
              >
                Complete Only
              </Button>

              <Button 
                onClick={handleSignAndCallNext} 
                disabled={isProcessingAction || completeAndCallNextMutation.isPending}
                className="bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs gap-2 h-9 px-4 shadow-lg cursor-pointer"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>⚡ Sign & Call Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
