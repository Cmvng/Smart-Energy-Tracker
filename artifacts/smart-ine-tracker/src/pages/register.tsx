import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Wallet, UserPlus, Loader2, ArrowLeft } from "lucide-react";

import { useRegisterUser } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "KES", "GHS", "ZAR", "INR", "CAD", "AUD"];

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  mode: z.enum(["individual", "business"]),
  home_currency: z.string().min(3, "Currency is required"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { setToken } = useAuth();
  const { toast } = useToast();
  
  const registerMutation = useRegisterUser();

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      mode: "individual",
      home_currency: "USD"
    }
  });

  const selectedMode = watch("mode");

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      const response = await registerMutation.mutateAsync({ data });
      setToken(response.token);
      toast({
        title: "Account Created!",
        description: "Welcome to Smart i-n-E Tracker.",
      });
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error?.message || "Could not create account. Please try again.",
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen pb-10">
      {/* Decorative Header Area */}
      <div className="bg-primary pt-8 pb-20 px-6 rounded-b-[2.5rem] relative overflow-hidden shrink-0">
        <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
        
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link href="/login" className="inline-flex items-center text-primary-foreground/80 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm font-semibold">Back</span>
          </Link>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <h2 className="text-3xl font-display font-bold text-white mb-2">Create Account</h2>
          <p className="text-primary-foreground/70 text-sm">Join us to take control of your financial journey.</p>
        </motion.div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-6 -mt-10 relative z-20">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-card rounded-3xl p-6 shadow-xl shadow-black/5 border border-border"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <label className={`
                flex flex-col items-center justify-center p-3 rounded-2xl border-2 cursor-pointer transition-all duration-200
                ${selectedMode === 'individual' ? 'border-primary bg-primary/5' : 'border-border bg-transparent hover:border-primary/30'}
              `}>
                <input type="radio" value="individual" className="sr-only" {...formRegister("mode")} />
                <span className={`text-sm font-bold ${selectedMode === 'individual' ? 'text-primary' : 'text-muted-foreground'}`}>Individual</span>
              </label>
              <label className={`
                flex flex-col items-center justify-center p-3 rounded-2xl border-2 cursor-pointer transition-all duration-200
                ${selectedMode === 'business' ? 'border-primary bg-primary/5' : 'border-border bg-transparent hover:border-primary/30'}
              `}>
                <input type="radio" value="business" className="sr-only" {...formRegister("mode")} />
                <span className={`text-sm font-bold ${selectedMode === 'business' ? 'text-primary' : 'text-muted-foreground'}`}>Business</span>
              </label>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block ml-1">Full Name</label>
              <Input
                type="text"
                placeholder="John Doe"
                {...formRegister("name")}
                className={errors.name ? "border-destructive focus-visible:ring-destructive/10" : ""}
              />
              {errors.name && (
                <p className="text-xs text-destructive font-medium ml-1">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block ml-1">Email Address</label>
              <Input
                type="email"
                placeholder="you@example.com"
                {...formRegister("email")}
                className={errors.email ? "border-destructive focus-visible:ring-destructive/10" : ""}
              />
              {errors.email && (
                <p className="text-xs text-destructive font-medium ml-1">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block ml-1">Password</label>
              <Input
                type="password"
                placeholder="Min 6 characters"
                {...formRegister("password")}
                className={errors.password ? "border-destructive focus-visible:ring-destructive/10" : ""}
              />
              {errors.password && (
                <p className="text-xs text-destructive font-medium ml-1">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground block ml-1">Home Currency</label>
              <SelectNative {...formRegister("home_currency")}>
                {CURRENCIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </SelectNative>
              {errors.home_currency && (
                <p className="text-xs text-destructive font-medium ml-1">{errors.home_currency.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full mt-4" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Create Account
                </>
              )}
            </Button>
          </form>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 text-center"
        >
          <p className="text-sm text-muted-foreground font-medium">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
