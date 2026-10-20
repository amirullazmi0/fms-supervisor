'use client';
// Operator: data karyawan yang ditugaskan di shift, beserta PIN login tablet MDT.
import { useEffect } from 'react';
import DriverManager from '@/components/fleet/DriverManager';
import { HeaderStat, useLayout } from '@/components/fleet/Layout';
import { PageHeader } from '@/components/fleet/Page';
import { useData } from '@/provider/StreamProvider';
import { P, useCan } from '@/lib/permissions';

export default function OperatorsView() {
    const { drivers } = useData();
    const { setStats } = useLayout();
    const can = useCan();

    useEffect(() => {
        setStats(
            <>
                <HeaderStat label="Operator aktif" value={drivers.filter((d) => d.active).length} />
                <HeaderStat
                    label="Bisa login MDT"
                    value={drivers.filter((d) => d.active && d.hasPin).length}
                />
            </>,
        );
        return () => setStats(null);
    }, [drivers, setStats]);

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
            <PageHeader
                title="Operator"
                description="Operator adalah user bertipe operator: login di tablet MDT menggunakan NIK + PIN, bukan di dashboard."
            />
            <DriverManager canEdit={can(P.driverCreate) || can(P.driverUpdate)} />
        </div>
    );
}
