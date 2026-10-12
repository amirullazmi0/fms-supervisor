import * as yup from 'yup';

export const SignInSchema = yup.object().shape({
    email: yup.string().trim().required('Email wajib diisi').email('Format email nggak valid'),
    password: yup.string().required('Password wajib diisi'),
});

export type SignInFormData = yup.InferType<typeof SignInSchema>;
