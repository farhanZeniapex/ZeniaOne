import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import styles from "./lead-form.module.css";

export function LeadForm() {
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        company_name: '',
        preferred_call_time: '',
        notes: ''
    });
    
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const validatePhone = (phone: string) => {
        const regex = /^\+?[\d\s-]{10,15}$/;
        return regex.test(phone);
    };

    const validateEmail = (email: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return email === '' || regex.test(email); // Email is optional, but if provided, must be valid
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.name.trim() || !formData.phone.trim()) {
            setErrorMsg("Name and Phone are required.");
            setStatus('error');
            return;
        }

        if (!validatePhone(formData.phone)) {
            setErrorMsg("Please enter a valid phone number.");
            setStatus('error');
            return;
        }

        if (formData.email && !validateEmail(formData.email)) {
            setErrorMsg("Please enter a valid email address.");
            setStatus('error');
            return;
        }

        setStatus('loading');
        setErrorMsg('');

        try {
            // Send to Next.js API route to hide company ID
            const res = await fetch('/api/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name,
                    phone: formData.phone,
                    email: formData.email || undefined,
                    company_name: formData.company_name || undefined,
                    preferred_call_time: formData.preferred_call_time ? new Date(formData.preferred_call_time).toISOString() : undefined,
                    notes: formData.notes || undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to submit request.");
            }

            setStatus('success');
            setFormData({
                name: '',
                phone: '',
                email: '',
                company_name: '',
                preferred_call_time: '',
                notes: ''
            });
        } catch (err: unknown) {
            setErrorMsg(err instanceof Error ? err.message : "Failed to submit request.");
            setStatus('error');
        }
    };

    return (
        <section id="demo" className={styles.section}>
            <div className={styles.container}>
                <div className={styles.copy}>
                    <span className={styles.kicker}>06 / LET&apos;S TALK</span>
                    <h2>
                        See the difference <em>in a real conversation.</em>
                    </h2>
                    <p>
                        Tell us a little about your business. We&apos;ll show you how ZeniaOne can chat, speak, and answer calls for your team.
                    </p>
                    <div className={styles.channels}><span>Chat</span><i /><span>Live voice</span><i /><span>Phone calls</span></div>
                </div>

                <div className={styles.formCard}>
                    <div className={styles.formIntro}><span>PERSONALIZED WALKTHROUGH</span><h3>Book your demo</h3><p>We&apos;ll be in touch to find a time that works.</p></div>
                    {status === 'success' ? (
                        <div className="text-center py-10">
                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600 mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-[#191614] mb-2">Request Submitted Successfully</h3>
                            <p className="text-[#5E5A54]">Thank you! We will be in touch shortly.</p>
                            <Button 
                                onClick={() => setStatus('idle')}
                                className="mt-6 bg-[#3E5448] hover:bg-[#33463B] text-white"
                            >
                                Submit Another Request
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="name" className="text-sm font-medium text-[#191614]">Full Name <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        id="name" 
                                        name="name" 
                                        value={formData.name} 
                                        onChange={handleChange} 
                                        className="w-full p-3 rounded-xl border border-[#EAE5DC] bg-white focus:outline-none focus:ring-2 focus:ring-[#3E5448]"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="phone" className="text-sm font-medium text-[#191614]">Phone Number <span className="text-red-500">*</span></label>
                                    <input 
                                        type="tel" 
                                        id="phone" 
                                        name="phone" 
                                        value={formData.phone} 
                                        onChange={handleChange} 
                                        className="w-full p-3 rounded-xl border border-[#EAE5DC] bg-white focus:outline-none focus:ring-2 focus:ring-[#3E5448]"
                                        placeholder="+1 234 567 8900"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="email" className="text-sm font-medium text-[#191614]">Email Address</label>
                                    <input 
                                        type="email" 
                                        id="email" 
                                        name="email" 
                                        value={formData.email} 
                                        onChange={handleChange} 
                                        className="w-full p-3 rounded-xl border border-[#EAE5DC] bg-white focus:outline-none focus:ring-2 focus:ring-[#3E5448]"
                                        placeholder="john@company.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="company_name" className="text-sm font-medium text-[#191614]">Company Name</label>
                                    <input 
                                        type="text" 
                                        id="company_name" 
                                        name="company_name" 
                                        value={formData.company_name} 
                                        onChange={handleChange} 
                                        className="w-full p-3 rounded-xl border border-[#EAE5DC] bg-white focus:outline-none focus:ring-2 focus:ring-[#3E5448]"
                                        placeholder="Acme Corp"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="preferred_call_time" className="text-sm font-medium text-[#191614]">Preferred Call Time</label>
                                <input 
                                    type="datetime-local" 
                                    id="preferred_call_time" 
                                    name="preferred_call_time" 
                                    value={formData.preferred_call_time} 
                                    onChange={handleChange} 
                                    className="w-full p-3 rounded-xl border border-[#EAE5DC] bg-white focus:outline-none focus:ring-2 focus:ring-[#3E5448]"
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="notes" className="text-sm font-medium text-[#191614]">Notes (Optional)</label>
                                <textarea 
                                    id="notes" 
                                    name="notes" 
                                    rows={4} 
                                    value={formData.notes} 
                                    onChange={handleChange} 
                                    className="w-full p-3 rounded-xl border border-[#EAE5DC] bg-white focus:outline-none focus:ring-2 focus:ring-[#3E5448]"
                                    placeholder="Tell us about your requirements..."
                                />
                            </div>

                            {status === 'error' && (
                                <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-medium">
                                    {errorMsg}
                                </div>
                            )}

                            <Button 
                                type="submit" 
                                disabled={status === 'loading'}
                                className="w-full h-12 bg-[#3E5448] hover:bg-[#33463B] text-white rounded-xl text-[15px] font-semibold"
                            >
                                {status === 'loading' ? 'Submitting...' : 'Request a Call'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </section>
    );
}
