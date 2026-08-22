import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Check, ChevronsUpDown, Building } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import api from '@/api/client';

type Branch = {
  id: string;
  name: string;
  isMainBranch: boolean;
};

export function BranchSwitcher() {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const { user } = useAuthStore();
  
  // Use a local state for the active branch or a zustand store if it's needed globally.
  // We'll store the active branch id in localStorage for now and update later if a context is added.
  const [activeBranchId, setActiveBranchId] = useState<string | null>(
    localStorage.getItem('activeBranchId')
  );

  useEffect(() => {
    // Only admin/superadmin should be able to switch branches typically,
    // but here we just fetch all branches for their clinic.
    if (!user) return;
    
    const fetchBranches = async () => {
      try {
        const response = await api.get('/branches');
        setBranches(response.data);
        if (response.data.length > 0 && !activeBranchId) {
            const mainBranch = response.data.find((b: Branch) => b.isMainBranch) || response.data[0];
            setActiveBranchId(mainBranch.id);
            localStorage.setItem('activeBranchId', mainBranch.id);
        }
      } catch (error) {
        console.error("Failed to fetch branches", error);
      }
    };
    
    fetchBranches();
  }, [user, activeBranchId]);

  if (!user || user.role === 'patient') return null;
  if (branches.length === 0) return null;

  const activeBranch = branches.find((branch) => branch.id === activeBranchId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between border-stone-200 dark:border-stone-800"
        >
          <div className="flex items-center truncate">
            <Building className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <span className="truncate">
              {activeBranch ? activeBranch.name : 'Select branch...'}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search branch..." />
          <CommandList>
            <CommandEmpty>No branch found.</CommandEmpty>
            <CommandGroup>
              {branches.map((branch) => (
                <CommandItem
                  key={branch.id}
                  value={branch.name}
                  onSelect={(currentValue) => {
                    const selected = branches.find((b) => b.name.toLowerCase() === currentValue.toLowerCase());
                    if (selected) {
                        setActiveBranchId(selected.id);
                        localStorage.setItem('activeBranchId', selected.id);
                        // Trigger a reload or event so other components refresh data for this branch
                        window.dispatchEvent(new Event('branch-changed'));
                    }
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      activeBranchId === branch.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {branch.name}
                  {branch.isMainBranch && <span className="ml-auto text-xs text-stone-400">(Main)</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
