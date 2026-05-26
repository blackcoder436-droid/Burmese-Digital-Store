export type RotationAccountId = 'do-account-1' | 'do-account-2';

export type RotationTargetId = 'jan' | 'sg1' | 'sg2' | 'sg3' | 'sg4' | 'backup';

export type RotationTarget = {
	id: RotationTargetId;
	label: string;
	shortLabel: string;
	accountId: RotationAccountId;
	accountLabel: string;
	region: string;
	domain: string;
	note: string;
};

export const ROTATION_TARGETS: readonly RotationTarget[] = [
	{
		id: 'jan',
		label: 'Jan Server',
		shortLabel: 'Jan',
		accountId: 'do-account-1',
		accountLabel: 'DigitalOcean Account 1',
		region: 'sgp1',
		domain: 'jan.burmesedigital.store',
		note: 'Primary server on Account 1',
	},
	{
		id: 'sg1',
		label: 'SG-1 Server',
		shortLabel: 'SG-1',
		accountId: 'do-account-1',
		accountLabel: 'DigitalOcean Account 1',
		region: 'sgp1',
		domain: 'jan.burmesedigital.store',
		note: 'Shares Account 1 with Jan and SG-4',
	},
	{
		id: 'sg2',
		label: 'SG-2 Server',
		shortLabel: 'SG-2',
		accountId: 'do-account-2',
		accountLabel: 'DigitalOcean Account 2',
		region: 'sgp1',
		domain: 'sg2.burmesedigital.store',
		note: 'Account 2 pool server',
	},
	{
		id: 'sg3',
		label: 'SG-3 Server',
		shortLabel: 'SG-3',
		accountId: 'do-account-2',
		accountLabel: 'DigitalOcean Account 2',
		region: 'sgp1',
		domain: 'sg3.burmesedigital.store',
		note: 'Account 2 pool server',
	},
	{
		id: 'sg4',
		label: 'SG-4 Server',
		shortLabel: 'SG-4',
		accountId: 'do-account-1',
		accountLabel: 'DigitalOcean Account 1',
		region: 'nyc1',
		domain: 'sg4.burmesedigital.store',
		note: 'NYC1 server on Account 1',
	},
	{
		id: 'backup',
		label: 'Backup Server',
		shortLabel: 'Backup',
		accountId: 'do-account-2',
		accountLabel: 'DigitalOcean Account 2',
		region: 'sgp1',
		domain: 'backup.burmesedigital.store',
		note: 'Backup server on Account 2',
	},
] as const;

export const ROTATION_TARGET_GROUPS = [
	{
		accountId: 'do-account-1' as const,
		label: 'DigitalOcean Account 1',
		description: 'jan, sg1, sg4',
	},
	{
		accountId: 'do-account-2' as const,
		label: 'DigitalOcean Account 2',
		description: 'sg2, sg3, backup',
	},
] as const;

export function getRotationTarget(serverId: string): RotationTarget | undefined {
	return ROTATION_TARGETS.find((target) => target.id === serverId);
}

export function getRotationAccountId(serverId: string): RotationAccountId | undefined {
	return getRotationTarget(serverId)?.accountId;
}

export function getDoTokenField(serverId: string): 'doToken1' | 'doToken2' {
	return getRotationAccountId(serverId) === 'do-account-1' ? 'doToken1' : 'doToken2';
}