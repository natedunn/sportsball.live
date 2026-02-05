import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
	children: React.ReactNode;
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	/** If true, prevents closing via Escape key or backdrop click */
	modal?: boolean;
}

export function Dialog({ children, open, onOpenChange, modal = true }: DialogProps) {
	return (
		<BaseDialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
			{children}
		</BaseDialog.Root>
	);
}

interface DialogTriggerProps {
	children: React.ReactNode;
	className?: string;
	asChild?: boolean;
}

export function DialogTrigger({
	children,
	className,
	asChild,
}: DialogTriggerProps) {
	if (asChild && React.isValidElement(children)) {
		return <BaseDialog.Trigger render={children} className={className} />;
	}

	return (
		<BaseDialog.Trigger className={className}>{children}</BaseDialog.Trigger>
	);
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
	showCloseButton?: boolean;
}

export function DialogContent({
	children,
	className,
	showCloseButton = true,
	...props
}: DialogContentProps) {
	return (
		<BaseDialog.Portal>
			<BaseDialog.Backdrop
				className={cn(
					"fixed inset-0 z-50 bg-black/50 backdrop-blur-sm",
					"transition-opacity duration-150",
					"data-[ending-style]:opacity-0",
					"data-[starting-style]:opacity-0",
				)}
			/>
			<BaseDialog.Popup
				className={cn(
					"fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2",
					"overflow-auto rounded-xl border border-border bg-card shadow-lg",
					"transition-[transform,opacity] duration-150 ease-out",
					"data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
					"data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
					className,
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<BaseDialog.Close
						className={cn(
							"absolute right-4 top-4 rounded-sm p-1.5 opacity-70 transition-opacity",
							"hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						)}
						aria-label="Close dialog"
					>
						<X className="size-4" aria-hidden="true" />
					</BaseDialog.Close>
				)}
			</BaseDialog.Popup>
		</BaseDialog.Portal>
	);
}

interface DialogHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DialogHeader({ className, ...props }: DialogHeaderProps) {
	return (
		<div
			className={cn(
				"flex flex-col gap-1.5 border-b border-border p-4 sm:p-6",
				className,
			)}
			{...props}
		/>
	);
}

interface DialogTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}

export function DialogTitle({ className, ...props }: DialogTitleProps) {
	return (
		<BaseDialog.Title
			className={cn("text-lg font-semibold leading-none tracking-tight", className)}
			{...props}
		/>
	);
}

interface DialogDescriptionProps
	extends React.HTMLAttributes<HTMLParagraphElement> {}

export function DialogDescription({
	className,
	...props
}: DialogDescriptionProps) {
	return (
		<BaseDialog.Description
			className={cn("text-sm text-muted-foreground", className)}
			{...props}
		/>
	);
}

interface DialogBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export function DialogBody({ className, ...props }: DialogBodyProps) {
	return <div className={cn("p-4 sm:p-6", className)} {...props} />;
}
