'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import {
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Database,
	Globe,
	Loader2,
	PlayCircle,
	Server,
	Settings,
	Terminal,
	XCircle,
} from 'lucide-react';

type RotateConfig = {
	doToken1: string;
	doToken2: string;
	cfToken: string;
	cfEmail: string;
	xuiUsername: string;
	xuiPassword: string;
	enable2FA: boolean;
	dropletSize: string;
	dropletImage: string;
};

type StepResult = {
	status: 'loading' | 'success' | 'error';
	message?: string;
	newIp?: string;
};

const STEPS = [
	{ id: 1, title: 'Config', icon: Settings },
	{ id: 2, title: 'Backup', icon: Database },
	{ id: 3, title: 'Recreate', icon: Server },
	{ id: 4, title: 'DNS', icon: Globe },
	{ id: 5, title: 'Panel', icon: Terminal },
] as const;

const SERVER_OPTIONS = [
	{ value: 'jan', label: 'Jan Server (Account 1)' },
	{ value: 'sg1', label: 'SG-1 Server (Account 1)' },
	{ value: 'sg2', label: 'SG-2 Server (Account 2)' },
	{ value: 'sg3', label: 'SG-3 Server (Account 2)' },
	{ value: 'sg4', label: 'SG-4 Server (Account 1 - NYC1)' },
	{ value: 'backup', label: 'Backup Server (Account 2)' },
] as const;

const DEFAULT_CONFIG: RotateConfig = {
	doToken1: '',
	doToken2: '',
	cfToken: '',
	cfEmail: 'blackcoder436@gmail.com',
	xuiUsername: 'Blackcoder',
	xuiPassword: 'Mka@2016',
	enable2FA: false,
	dropletSize: 's-1vcpu-1gb',
	dropletImage: 'ubuntu-22-04-x64',
};

const DROPLET_SIZE_OPTIONS = [
	{ value: 's-1vcpu-1gb', label: '$6.00/mo', description: '1 vCPU - 1 GB RAM - 25 GB SSD - 1000 GB Transfer' },
	{ value: 's-1vcpu-2gb', label: '$12.00/mo', description: '1 vCPU - 2 GB RAM - 50 GB SSD - 2 TB Transfer' },
	{ value: 's-2vcpu-2gb', label: '$18.00/mo', description: '2 vCPU - 2 GB RAM - 60 GB SSD - 3 TB Transfer' },
	{ value: 's-2vcpu-4gb', label: '$24.00/mo', description: '2 vCPU - 4 GB RAM - 80 GB SSD - 4 TB Transfer' },
	{ value: 's-4vcpu-8gb', label: '$48.00/mo', description: '4 vCPU - 8 GB RAM - 160 GB SSD - 5 TB Transfer' },
	{ value: 's-8vcpu-16gb', label: '$96.00/mo', description: '8 vCPU - 16 GB RAM - 320 GB SSD - 6 TB Transfer' },
] as const;

const DROPLET_IMAGE_OPTIONS = [
	{ value: 'ubuntu-24-04-x64', label: 'Ubuntu 24.04 x64' },
	{ value: 'ubuntu-22-04-x64', label: 'Ubuntu 22.04 x64' },
	{ value: 'ubuntu-20-04-x64', label: 'Ubuntu 20.04 x64' },
	{ value: 'debian-12-x64', label: 'Debian 12 x64' },
	{ value: 'debian-11-x64', label: 'Debian 11 x64' },
	{ value: 'almalinux-9-x64', label: 'AlmaLinux 9 x64' },
	{ value: 'rockylinux-9-x64', label: 'Rocky Linux 9 x64' },
	{ value: 'fedora-41-x64', label: 'Fedora 41 x64' },
] as const;

export default function RotateWizardPage() {
	const [loading, setLoading] = useState(true);
	const [actionLoading, setActionLoading] = useState(false);
	const [currentStep, setCurrentStep] = useState(1);
	const [targetServer, setTargetServer] = useState('sg1');
	const [config, setConfig] = useState(DEFAULT_CONFIG);
	const [stepResults, setStepResults] = useState<Record<number, StepResult>>({});

	useEffect(() => {
		let mounted = true;

		async function loadConfig() {
			try {
				const response = await fetch('/api/admin/rotate-config');
				const data = await response.json();

				if (mounted && data?.success && data?.data?.config) {
					setConfig((prev) => ({ ...prev, ...data.data.config }));
				}
			} catch {
				toast.error('Unable to load rotation config');
			} finally {
				if (mounted) setLoading(false);
			}
		}

		void loadConfig();

		return () => {
			mounted = false;
		};
	}, []);

	function handleConfigChange(event: any) {
		const target = event.target;
		const name = target.name;
		const type = target.type;
		const checked = target.checked;
		const value = target.value;
		
		setConfig((current) => ({
			...current,
			[name]: type === 'checkbox' ? checked : value,
		} as RotateConfig));
	}

	async function handleSaveConfig() {
		setActionLoading(true);

		try {
			const response = await fetch('/api/admin/rotate-config', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(config),
			});

			const data = await response.json();
			if (data?.success) {
				toast.success('Configuration saved successfully');
				setCurrentStep(2);
			} else {
				toast.error(data?.error || 'Failed to save configuration');
			}
		} catch {
			toast.error('Network error while saving configuration');
		} finally {
			setActionLoading(false);
		}
	}

	async function handleOneClickRotate() {
		setActionLoading(true);

		try {
			const response = await fetch('/api/admin/rotate-server', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId: targetServer }),
			});

			const data = await response.json();

			if (data?.success) {
				toast.success(data.message || 'One-click rotation started');
				setCurrentStep(2);
			} else {
				toast.error(data?.error || 'Failed to start rotation');
			}
		} catch {
			toast.error('Network error while starting rotation');
		} finally {
			setActionLoading(false);
		}
	}

	async function executeAction(action: string, stepNumber: number) {
		setActionLoading(true);
		setStepResults((prev) => ({ ...prev, [stepNumber]: { status: 'loading' } }));

		try {
			const response = await fetch('/api/admin/rotate-workflow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serverId: targetServer, action }),
			});

			const data = await response.json();

			if (data?.success) {
				setStepResults((prev) => ({
					...prev,
					[stepNumber]: {
						status: 'success',
						message: data.message,
						newIp: data.newIp,
					},
				}));
				toast.success(data.message || 'Step completed');

				if (stepNumber < 5) {
					window.setTimeout(() => setCurrentStep(stepNumber + 1), 900);
				}
			} else {
				setStepResults((prev) => ({
					...prev,
					[stepNumber]: { status: 'error', message: data?.error || 'Action failed' },
				}));
				toast.error(data?.error || 'Action failed');
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Network error occurred';
			setStepResults((prev) => ({
				...prev,
				[stepNumber]: { status: 'error', message },
			}));
			toast.error(message);
		} finally {
			setActionLoading(false);
		}
	}

	if (loading) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center bg-slate-950 text-white">
				<div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-3 shadow-xl shadow-sky-500/10 backdrop-blur">
					<Loader2 className="h-5 w-5 animate-spin text-sky-400" />
					<span className="text-sm font-medium text-slate-200">Loading rotation wizard...</span>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_55%,#111827_100%)] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto w-full">
				<div className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-sky-950/20 backdrop-blur-xl sm:p-8">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
						<div>
							<p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300/80">Admin Workflow</p>
							<h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Server Rotation Wizard</h1>
							<p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
								Step-by-step rotation with inline progress.
							</p>
						</div>

						<div className="flex flex-col items-start gap-3">
							<div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
								{targetServer}
							</div>
							<button
								type="button"
								onClick={handleOneClickRotate}
								disabled={actionLoading}
								className="inline-flex items-center justify-center rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
								One-click rotate
							</button>
							<p className="text-xs text-slate-400">Launch the full background rotate job.</p>
						</div>
					</div>
				</div>

				<div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
					{STEPS.map((step) => {
						const isActive = currentStep === step.id;
						const isDone = currentStep > step.id;
						const StepIcon = step.icon;

						return (
							<button
								key={step.id}
								type="button"
								onClick={() => setCurrentStep(step.id)}
								disabled={actionLoading}
								className={`group rounded-2xl border p-4 text-left transition-all duration-300 ${
									isActive
										? 'border-sky-400/60 bg-sky-400/15 shadow-lg shadow-sky-500/10'
										: isDone
											? 'border-emerald-400/40 bg-emerald-400/10'
											: 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
								}`}
							>
								<div className="flex items-center gap-3">
									<div className={`flex h-11 w-11 items-center justify-center rounded-full ${isActive ? 'bg-sky-400 text-slate-950' : isDone ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-300'}`}>
										{isDone ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
									</div>
									<div>
										<p className={`text-sm font-semibold ${isActive || isDone ? 'text-white' : 'text-slate-200'}`}>
											{step.title}
										</p>
									</div>
								</div>
							</button>
						);
					})}
				</div>

				<div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-2xl shadow-slate-950/30 backdrop-blur-xl">
					{currentStep === 1 && (
						<section className="animate-in fade-in slide-in-from-right-4 duration-500 p-6 sm:p-8">
							<StepHeader
								step={1}
								title="Config"
								description="Choose server and credentials."
							/>

							<div className="grid gap-8 lg:grid-cols-2">
								<div className="space-y-5">
									<div>
										<div className="mt-3 grid gap-3 sm:grid-cols-2">
											{SERVER_OPTIONS.map((option) => {
												const selected = targetServer === option.value;
												return (
													<button
														key={option.value}
														type="button"
														onClick={() => setTargetServer(option.value)}
														className={`rounded-2xl border px-4 py-4 text-left transition-all ${
															selected
																? 'border-sky-400/70 bg-sky-400/15 text-white'
																: 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10'
														}`}
													>
														<div className="flex items-center gap-3">
															<div className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-sky-300 bg-sky-400' : 'border-slate-500'}`}>
																{selected ? <span className="h-1.5 w-1.5 rounded-full bg-slate-950" /> : null}
															</div>
															<span className="text-sm font-medium leading-5">{option.label}</span>
														</div>
													</button>
												);
											})}
										</div>
									</div>

									<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
										<h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">DO</h3>
										<div className="mt-4 grid gap-4">
											<Field label="Token 1" name="doToken1" value={config.doToken1} onChange={handleConfigChange} type="password" />
											<Field label="Token 2" name="doToken2" value={config.doToken2} onChange={handleConfigChange} type="password" />
											<div className="grid gap-4 sm:grid-cols-2">
												<SelectField
													label="Droplet size"
													name="dropletSize"
													value={config.dropletSize}
													onChange={handleConfigChange}
													options={DROPLET_SIZE_OPTIONS}
												/>
												<SelectField
													label="Droplet image"
													name="dropletImage"
													value={config.dropletImage}
													onChange={handleConfigChange}
													options={DROPLET_IMAGE_OPTIONS}
												/>
											</div>
										</div>
									</div>
								</div>

								<div className="space-y-5">
									<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
										<h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">X-UI</h3>
										<div className="mt-4 grid gap-4">
											<Field label="Username" name="xuiUsername" value={config.xuiUsername} onChange={handleConfigChange} />
											<Field label="Password" name="xuiPassword" value={config.xuiPassword} onChange={handleConfigChange} type="password" />
											<label className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-200">
												<input
													type="checkbox"
													name="enable2FA"
													checked={config.enable2FA}
													onChange={handleConfigChange}
													className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500 focus:ring-sky-500"
												/>
												Enable 2FA during install
											</label>
										</div>
									</div>

									<div className="rounded-2xl border border-white/10 bg-white/5 p-4">
										<h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300/80">CF</h3>
										<div className="mt-4 grid gap-4">
											<Field label="API token" name="cfToken" value={config.cfToken} onChange={handleConfigChange} type="password" />
											<Field label="Account email" name="cfEmail" value={config.cfEmail} onChange={handleConfigChange} type="email" />
										</div>
									</div>
								</div>
							</div>

							<div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-end">
								<button
									type="button"
									onClick={handleSaveConfig}
									disabled={actionLoading}
									className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
									Next
									<ChevronRight className="ml-2 h-4 w-4" />
								</button>
							</div>
						</section>
					)}

					{currentStep >= 2 && currentStep <= 5 && (
						<section className="animate-in fade-in slide-in-from-right-4 duration-500 p-6 sm:p-8">
							<StepHeader
								step={currentStep}
								title={STEPS[currentStep - 1].title}
								description="Run and review."
							/>

							<div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
								<div className="rounded-2xl border border-white/10 bg-white/5 p-5">
									<div className="flex items-center justify-between gap-4">
										<div>
											<p className="text-xs uppercase tracking-[0.24em] text-slate-400">Target</p>
											<p className="mt-2 text-lg font-semibold text-white uppercase">{targetServer}</p>
										</div>
										<div className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-medium text-sky-200">
											Step {currentStep} of 5
										</div>
									</div>

									<div className="mt-6 flex flex-wrap gap-3">
										<button
											type="button"
											onClick={() => {
												const actions: Record<number, string> = {
													2: 'backup',
													3: 'recreate_vps',
													4: 'update_dns',
													5: 'install_3xui',
												};

												void executeAction(actions[currentStep], currentStep);
											}}
											disabled={actionLoading}
											className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
										>
											{actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
											Run
										</button>

										<button
											type="button"
											onClick={() => setCurrentStep((value) => Math.max(1, value - 1))}
											disabled={actionLoading || currentStep === 1}
											className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
										>
											<ChevronLeft className="mr-2 h-4 w-4" />
											Back
										</button>
									</div>
								</div>

								<div className="space-y-4">
									<ResultCard stepNumber={currentStep} result={stepResults[currentStep]} />
								</div>
							</div>

							<div className="mt-8 flex justify-end border-t border-white/10 pt-6">
								<button
									type="button"
									onClick={() => setCurrentStep((value) => Math.min(5, value + 1))}
									disabled={actionLoading || stepResults[currentStep]?.status !== 'success' || currentStep === 5}
									className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
								>
									{currentStep === 5 ? 'Finish' : 'Next step'}
									<ChevronRight className="ml-2 h-4 w-4" />
								</button>
							</div>
						</section>
					)}
				</div>
			</div>
		</div>
	);
}

function StepHeader({
	step,
	title,
	description,
}: {
	step: number;
	title: string;
	description: string;
}) {
	return (
		<div className="mb-6 border-b border-white/10 pb-6">
			<p className="text-xs font-semibold uppercase tracking-[0.35em] text-sky-300/70">Step {step}</p>
			<h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">{title}</h2>
			<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
		</div>
	);
}

function Field({
	label,
	name,
	value,
	onChange,
	type = 'text',
}: {
	label: string;
	name: string;
	value: string;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	type?: string;
}) {
	return (
		<label className="block">
			<span className="text-sm text-slate-300">{label}</span>
			<input
				name={name}
				type={type}
				value={value}
				onChange={onChange}
				className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
			/>
		</label>
	);
}

function SelectField({
	label,
	name,
	value,
	onChange,
	options,
}: {
	label: string;
	name: string;
	value: string;
	onChange: (event: { target: { name: string; value: string; type?: string; checked?: boolean } }) => void;
	options: ReadonlyArray<{ value: string; label: string; description?: string }>;
}) {
	const [isOpen, setIsOpen] = useState(false);
	const selectedOption = options.find((o) => o.value === value) || options[0];

	return (
		<div className="block relative">
			<span className="text-sm text-slate-300">{label}</span>
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="mt-2 w-full flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition hover:border-white/20 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/20"
			>
				<span className="truncate">
					{selectedOption?.label} {selectedOption?.description ? `- ${selectedOption.description}` : ''}
				</span>
				<ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
			</button>

			{isOpen && (
				<>
					<div
						className="fixed inset-0 z-10"
						onClick={() => setIsOpen(false)}
					/>
					<div className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-2xl border border-white/10 bg-slate-900 py-1 shadow-xl shadow-black/50 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
						{options.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => {
									onChange({ target: { name, value: option.value } });
									setIsOpen(false);
								}}
								className={`flex w-full flex-col items-start px-4 py-3 text-left transition hover:bg-white/5 ${
									value === option.value ? 'bg-sky-500/10 text-sky-400' : 'text-slate-200'
								}`}
							>
								<span className="font-medium">{option.label}</span>
								{option.description && (
									<span className="mt-0.5 text-xs text-slate-400">{option.description}</span>
								)}
							</button>
						))}
					</div>
				</>
			)}
		</div>
	);
}

function ResultCard({ stepNumber, result }: { stepNumber: number; result?: StepResult }) {
	if (!result) {
		return (
			<div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-slate-400">
				Run step {stepNumber} to see the live result here.
			</div>
		);
	}

	if (result.status === 'loading') {
		return (
			<div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-6 text-sm text-sky-100">
				<Loader2 className="mr-2 inline h-4 w-4 animate-spin align-[-2px]" />
				Running step {stepNumber}...
			</div>
		);
	}

	if (result.status === 'success') {
		return (
			<div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-sm text-emerald-50">
				<CheckCircle2 className="mr-2 inline h-5 w-5 align-[-4px] text-emerald-300" />
				<div className="mt-2 font-semibold text-white">Step completed successfully</div>
				{result.message ? <p className="mt-2 text-emerald-100/90">{result.message}</p> : null}
				{result.newIp ? (
					<div className="mt-4 inline-flex rounded-full bg-emerald-950/50 px-3 py-1 font-mono text-xs text-emerald-200">
						New IP: {result.newIp}
					</div>
				) : null}
			</div>
		);
	}

	return (
		<div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-6 text-sm text-red-50">
			<XCircle className="mr-2 inline h-5 w-5 align-[-4px] text-red-300" />
			<div className="mt-2 font-semibold text-white">Step failed</div>
			{result.message ? <p className="mt-2 text-red-100/90">{result.message}</p> : null}
			<button
				type="button"
				onClick={() => window.location.reload()}
				className="mt-4 rounded-full border border-red-300/20 bg-red-950/40 px-4 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-950/60"
			>
				Reload page
			</button>
		</div>
	);
}
