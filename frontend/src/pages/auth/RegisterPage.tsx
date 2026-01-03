import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import { validatePassword } from "@/utils/validation";
import { DEPARTMENTS } from "@/constants";
import { useState } from "react";

const registerSchema = z
  .object({
    fullName: z.string().min(2, "Full name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .refine(
        (val) => validatePassword(val).isValid,
        "Password must contain uppercase, lowercase, number, and special character"
      ),
    confirmPassword: z.string(),
    phone: z.string().min(10, "Phone number must be at least 10 characters"),
    department: z.string().optional(),
    branch: z.string().optional(),
    yearOfStudy: z.number().min(1).max(4).optional(),
    rollNumber: z.string().optional(),
    isOutsideCollege: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const { registerAsync, isRegistering, registerError } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      department: "",
      branch: "",
      yearOfStudy: 1,
      rollNumber: "",
      isOutsideCollege: false,
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      const { confirmPassword, ...registerData } = data;
      const result = await registerAsync(registerData);
      if (result?.data?.user) {
        toast.success("Account created successfully!");
        setTimeout(() => navigate("/dashboard"), 100);
      }
    } catch (error: any) {
      // Provide specific error messages
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.message ||
        "Registration failed. Please check your information.";
      toast.error(errorMessage);
      // Clear password fields on error for security
      form.setValue("password", "");
      form.setValue("confirmPassword", "");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-background to-muted p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Create a Student Account
          </CardTitle>
          <CardDescription>
            Enter your information to register as a student
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {registerError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {(registerError as any)?.response?.data?.message ||
                      "Registration failed"}
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="John Doe"
                          {...field}
                          disabled={isRegistering}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@example.com"
                          {...field}
                          disabled={isRegistering}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => {
                    const passwordValidation = validatePassword(
                      field.value || ""
                    );
                    return (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter your password"
                              {...field}
                              disabled={isRegistering}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showPassword ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </FormControl>
                        {field.value && (
                          <div className="space-y-1 text-xs mt-2">
                            <div className="flex items-center gap-1">
                              {field.value.length >= 8 ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              <span
                                className={
                                  field.value.length >= 8
                                    ? "text-green-600"
                                    : "text-muted-foreground"
                                }
                              >
                                At least 8 characters
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {/[A-Z]/.test(field.value) ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              <span
                                className={
                                  /[A-Z]/.test(field.value)
                                    ? "text-green-600"
                                    : "text-muted-foreground"
                                }
                              >
                                One uppercase letter
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {/[a-z]/.test(field.value) ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              <span
                                className={
                                  /[a-z]/.test(field.value)
                                    ? "text-green-600"
                                    : "text-muted-foreground"
                                }
                              >
                                One lowercase letter
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {/\d/.test(field.value) ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              <span
                                className={
                                  /\d/.test(field.value)
                                    ? "text-green-600"
                                    : "text-muted-foreground"
                                }
                              >
                                One number
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {/[!@#$%^&*(),.?":{}|<>]/.test(field.value) ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <X className="h-3 w-3 text-red-500" />
                              )}
                              <span
                                className={
                                  /[!@#$%^&*(),.?":{}|<>]/.test(field.value)
                                    ? "text-green-600"
                                    : "text-muted-foreground"
                                }
                              >
                                One special character
                              </span>
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm your password"
                            {...field}
                            disabled={isRegistering}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setShowConfirmPassword(!showConfirmPassword)
                            }
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+1234567890"
                          {...field}
                          disabled={isRegistering}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Student fields - always shown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={isRegistering}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) => (
                            <SelectItem key={dept.value} value={dept.value}>
                              {dept.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="branch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="CSE - AI & ML"
                          {...field}
                          disabled={isRegistering}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="yearOfStudy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year of Study</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                        defaultValue={field.value?.toString()}
                        disabled={isRegistering}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1st Year</SelectItem>
                          <SelectItem value="2">2nd Year</SelectItem>
                          <SelectItem value="3">3rd Year</SelectItem>
                          <SelectItem value="4">4th Year</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rollNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Roll Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="2021CS001"
                          {...field}
                          disabled={isRegistering}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isOutsideCollege"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Outside College Student
                      </FormLabel>
                      <FormDescription>
                        Check this if you are from another college/institution
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isRegistering}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isRegistering}>
                {isRegistering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              to="/auth/login"
              className="text-primary hover:underline font-medium"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
