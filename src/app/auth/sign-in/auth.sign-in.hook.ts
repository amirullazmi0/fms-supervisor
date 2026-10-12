'use client';
import { useForm } from 'react-hook-form';
import type { Resolver } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '@/hooks/react-query/useAuth';
import { apiErrorMessage } from '@/lib/api-error';
import { SignInSchema, SignInFormData } from './auth.sign-in.config';

export function useSignIn() {
    const { login } = useAuth();
    const {
        handleSubmit,
        register,
        formState: { errors },
    } = useForm<SignInFormData>({
        resolver: yupResolver(SignInSchema) as unknown as Resolver<SignInFormData>,
        mode: 'onBlur',
        defaultValues: { email: '', password: '' },
    });

    const onSubmit = (data: SignInFormData) => login.mutate(data);

    return {
        register,
        errors,
        handleSubmit: handleSubmit(onSubmit),
        isSubmitting: login.isPending || login.isSuccess,
        error: login.isError ? apiErrorMessage(login.error, 'Login gagal') : null,
    };
}
