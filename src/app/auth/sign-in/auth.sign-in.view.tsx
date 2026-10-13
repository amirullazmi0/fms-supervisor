'use client';
import { useState } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import AuthShowcase from '@/components/custom/auth-showcase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Note } from '@/components/ui/misc';
import { cn } from '@/lib/utils';
import { APP } from '@/lib/app';
import { useSignIn } from './auth.sign-in.hook';

const field = 'h-12 rounded-full border-input bg-card pl-5 pr-12 text-sm shadow-none';

export default function SignInView() {
    const { register, errors, handleSubmit, isSubmitting, error } = useSignIn();
    const [show, setShow] = useState(false);

    return (
        <main className="grid min-h-dvh place-items-center bg-frame p-4 md:p-8">
            <div className="grid w-full max-w-6xl gap-4 rounded-[2.25rem] bg-card p-4 shadow-[0_20px_60px_-20px_rgb(15_23_42/0.25)] md:grid-cols-2 md:p-5">
                <form
                    className="flex flex-col justify-center gap-5 px-4 py-10 md:px-12"
                    onSubmit={handleSubmit}
                    noValidate
                >
                    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-3 text-center">
                        <span
                            className={cn('grid size-12 place-items-center rounded-2xl', APP.tile)}
                        >
                            <APP.icon className="size-6" />
                        </span>
                        <span className="rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            FMS · {APP.label}
                        </span>
                        <h1 className="m-0 text-3xl font-bold tracking-tight">Selamat datang</h1>
                        <p className="m-0 text-sm text-muted-foreground">
                            Masuk ke FMS Supervisor buat lanjut.
                        </p>
                    </div>

                    <div className="mx-auto mt-4 flex w-full max-w-sm flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <div className="relative">
                                <label htmlFor="loginEmail" className="sr-only">
                                    Email
                                </label>
                                <Input
                                    id="loginEmail"
                                    type="email"
                                    placeholder="Email"
                                    autoComplete="username"
                                    className={field}
                                    aria-invalid={Boolean(errors.email)}
                                    {...register('email')}
                                />
                                <Mail className="pointer-events-none absolute right-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                            {errors.email && (
                                <p className="m-0 pl-5 text-xs text-destructive">
                                    {errors.email.message}
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col gap-1">
                            <div className="relative">
                                <label htmlFor="loginPassword" className="sr-only">
                                    Password
                                </label>
                                <Input
                                    id="loginPassword"
                                    type={show ? 'text' : 'password'}
                                    placeholder="Password"
                                    autoComplete="current-password"
                                    className={field}
                                    aria-invalid={Boolean(errors.password)}
                                    {...register('password')}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShow((v) => !v)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
                                    aria-label={
                                        show ? 'Sembunyikan password' : 'Tampilkan password'
                                    }
                                >
                                    {show ? (
                                        <EyeOff className="size-4" />
                                    ) : (
                                        <Eye className="size-4" />
                                    )}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="m-0 pl-5 text-xs text-destructive">
                                    {errors.password.message}
                                </p>
                            )}
                        </div>

                        {error && (
                            <Note tone="danger" className="rounded-2xl">
                                <span role="alert">{error}</span>
                            </Note>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            disabled={isSubmitting}
                            className={cn(
                                'mt-2 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90',
                            )}
                        >
                            {isSubmitting ? 'Masuk…' : 'Masuk'}
                        </Button>

                        <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="h-px flex-1 bg-border" />
                            Fleet Management System
                            <span className="h-px flex-1 bg-border" />
                        </div>
                        <p className="m-0 text-center text-xs text-muted-foreground">
                            Akun dibikin admin. Lupa password? Hubungi admin FMS.
                        </p>
                    </div>
                </form>

                <AuthShowcase />
            </div>
        </main>
    );
}
