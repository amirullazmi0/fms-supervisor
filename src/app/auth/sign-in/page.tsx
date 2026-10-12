import { Suspense } from 'react';
import SignInView from './auth.sign-in.view';

export default function SignInPage() {
    return (
        <Suspense>
            <SignInView />
        </Suspense>
    );
}
