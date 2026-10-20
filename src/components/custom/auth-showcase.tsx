'use client';
// Right half of the sign-in card: mining photos that crossfade, with a jumbotron caption.
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const SLIDES = [
    {
        src: '/images/login-loader.png',
        alt: 'Loader mengisi dump truck di area tambang batubara, dilihat dari atas',
        title: 'Setiap ritase tercatat otomatis',
        body: 'Loading sampai dumping dihitung dari GPS unit, lengkap dengan durasi, jarak, dan BBM.',
    },
    {
        src: '/images/login-site.png',
        alt: 'Area stockpile tambang dengan loader, conveyor, dan dump truck dari udara',
        title: 'Pantau armada tambang secara real-time',
        body: 'Posisi unit, shift, dan operator dalam satu layar, langsung dari alat FMC150.',
    },
];

export default function AuthShowcase() {
    const [i, setI] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setI((x) => (x + 1) % SLIDES.length), 6000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="relative hidden h-full min-h-[560px] overflow-hidden rounded-[1.75rem] bg-sidebar md:block">
            {SLIDES.map((s, k) => (
                <Image
                    key={s.src}
                    src={s.src}
                    alt={s.alt}
                    fill
                    priority={k === 0}
                    sizes="(min-width: 768px) 50vw, 0px"
                    className={cn(
                        'object-cover transition-opacity duration-1000',
                        k === i ? 'opacity-100' : 'opacity-0',
                    )}
                />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-8 text-white">
                <span className="w-fit rounded-full bg-brand px-3 py-1 text-xs font-semibold text-brand-foreground">
                    FMS · Fleet Management System
                </span>
                <h2 className="m-0 text-2xl font-bold leading-tight tracking-tight lg:text-3xl">
                    {SLIDES[i].title}
                </h2>
                <p className="m-0 max-w-md text-sm text-white/80">{SLIDES[i].body}</p>
                <div className="mt-1 flex gap-1.5" role="tablist" aria-label="Gambar">
                    {SLIDES.map((s, k) => (
                        <button
                            key={s.src}
                            type="button"
                            role="tab"
                            aria-selected={k === i}
                            aria-label={`Gambar ${k + 1}`}
                            onClick={() => setI(k)}
                            className={cn(
                                'h-1.5 rounded-full transition-all',
                                k === i ? 'w-6 bg-brand' : 'w-1.5 bg-white/50 hover:bg-white/80',
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
