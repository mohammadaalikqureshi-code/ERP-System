import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePatients } from '@/api/patients';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { Search, UserPlus } from 'lucide-react';
import { Patient } from '@/types';
import { useToast } from '@/components/ui/use-toast';

const PatientSearchContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data, isLoading } = usePatients({ q: debouncedSearch, page, pageSize });

  const columns = [
    { key: 'patientCode', title: 'Code', render: (val: string) => <span className="font-medium">{val}</span> },
    { key: 'firstName', title: 'Name', render: (_: any, row: Patient) => `${row.firstName} ${row.lastName}` },
    { key: 'mobile', title: 'Mobile' },
    { key: 'gender', title: 'Gender' },
    { key: 'id', title: 'Actions', render: (val: string) => (
      <Button variant="outline" size="sm" onClick={() => toast({ title: 'Patient Info', description: 'Patient ID: ' + val })}>
        View
      </Button>
    ) }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader title="Patient Search" description="Find existing patients or register a new one." />
        <Button onClick={() => navigate('/reception/patients')}>
          <UserPlus className="mr-2 h-4 w-4" />
          Register Patient
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, mobile, or code..."
          className="pl-8"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <DataTable
        columns={columns}
        data={data?.data || []}
        isLoading={isLoading}
        page={page}
        pageSize={pageSize}
        total={data?.total || 0}
        onPageChange={setPage}
      />
    </div>
  );
};

export default function PatientSearch() {
  return (
    <ErrorBoundary>
      <PatientSearchContent />
    </ErrorBoundary>
  );
}
