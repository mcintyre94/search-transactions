import type { Address, Signature } from '@solana/web3.js';

import { formatNumber } from '../utils/number-display';
import { TransactionSummary } from '../helius/summarise-transaction';
import { getAssetsQueryData } from '../queries/assetQueries';
import { Text } from '@mantine/core';
import { getAddressQueryData } from '../queries/addressQueries';
import { useMemo } from 'react';

export type TransactionRowData = {
    signature: Signature;
    feePayer: Address;
    success: boolean;
    knownApp: TransactionSummary['knownApp'];
    events: TransactionSummary['events'];
};

type AssetsData = ReturnType<typeof getAssetsQueryData>;
type AddressesData = ReturnType<typeof getAddressQueryData>;

type ActivityRowCategory = 'Sent' | 'Received' | 'App interaction' | 'Unknown' | 'Failed';

function activityRowCategory(row: TransactionRowData, userAddress: Address): ActivityRowCategory {
    if (!row.success) {
        return 'Failed';
    }

    if (row.events.length === 0) {
        return row.feePayer === userAddress ? 'App interaction' : 'Unknown';
    }

    const allSend = row.events.every((e) => e.kind === 'sent_nft' || e.kind === 'sent_sol' || e.kind === 'sent_token');
    if (allSend) return 'Sent';

    const allReceived = row.events.every(
        (e) => e.kind === 'received_nft' || e.kind === 'received_sol' || e.kind === 'received_token'
    );
    if (allReceived) return 'Received';

    return row.feePayer === userAddress ? 'App interaction' : 'Unknown';
}

type ActivityRowAsset = {
    description: string;
    image?: string;
};

const solIcon = 'https://solana.com/src/img/branding/solanaLogoMark.svg';

function getAssetFromEvent(event: TransactionSummary['events'][0], tokensData: AssetsData): ActivityRowAsset {
    if (event.kind === 'received_nft' || event.kind === 'sent_nft') {
        const tokenData = tokensData[event.assetId];
        if (tokenData) {
            return {
                description: tokenData.name ?? 'Unknown NFT',
                image: tokenData.image ?? undefined,
            };
        }
        return { description: 'Unknown NFT' };
    }
    if (event.kind === 'received_sol' || event.kind === 'sent_sol') {
        return {
            description: `${formatNumber(event.lamports, 9)} SOL`,
            image: solIcon,
        };
    }
    if (event.kind === 'received_token' || event.kind === 'sent_token') {
        const tokenData = tokensData[event.mint];
        const { unitAmount, decimals } = event;
        const formattedAmount = formatNumber(unitAmount, decimals);
        if (!tokenData || tokenData.kind !== 'fungibleToken') {
            return {
                description: `${formattedAmount} of an unknown token`,
            };
        }
        return {
            description: `${formattedAmount} ${tokenData.symbol}`,
            image: tokenData.image ?? undefined,
        };
    }
    return { description: 'Unknown' };
}

// Get the asset if there is a single one (if multiple we show them as separate events)
function activityRowAsset(
    row: TransactionRowData,
    category: ActivityRowCategory,
    tokensData: AssetsData
): ActivityRowAsset | null {
    if ((category === 'Received' || category === 'Sent') && row.events.length === 1) {
        return getAssetFromEvent(row.events[0], tokensData);
    }
    return null;
}

type ActivityRowIconData =
    | {
        kind: 'url';
        url: string;
    }
    | {
        kind: 'emoji';
        emoji: string;
    };

function activityRowIcon(asset: ActivityRowAsset | null, category: ActivityRowCategory): ActivityRowIconData {
    if (asset && asset.image) {
        return {
            kind: 'url',
            url: asset.image,
        };
    }

    if (category === 'App interaction') {
        return {
            kind: 'emoji',
            emoji: 'ℹ️',
        };
    }

    if (category === 'Failed') {
        return {
            kind: 'emoji',
            emoji: '❌',
        };
    }

    if (category === 'Received') {
        return {
            kind: 'emoji',
            emoji: '⬆️',
        };
    }

    if (category === 'Sent') {
        return {
            kind: 'emoji',
            emoji: '⬇️',
        };
    }

    return {
        kind: 'emoji',
        emoji: '❔',
    };
}

function activityRowTitle(category: ActivityRowCategory, asset: ActivityRowAsset | null) {
    if (category === 'App interaction') {
        return 'App Interaction';
    }

    if (category === 'Failed') {
        return 'Failed';
    }

    if (category === 'Received') {
        if (asset) {
            return `Received ${asset.description}`;
        }
        return 'Received';
    }

    if (category === 'Sent') {
        if (asset) {
            return `Sent ${asset.description}`;
        }
        return 'Sent';
    }

    return 'Unknown';
}

function getToAddresses(events: TransactionRowData['events']): Address[] {
    return events.flatMap((event) => {
        if (event.kind === 'sent_nft') {
            return [event.to];
        }
        if (event.kind === 'sent_sol') {
            return event.to;
        }
        if (event.kind === 'sent_token') {
            return event.to;
        }
        return [];
    });
}

function getFromAddresses(events: TransactionRowData['events']): Address[] {
    return events.flatMap((event) => {
        if (event.kind === 'received_nft') {
            return event.from ? [event.from] : [];
        }
        if (event.kind === 'received_sol') {
            return event.from;
        }
        if (event.kind === 'received_token') {
            return event.from;
        }
        return [];
    });
}

function truncateAddress(address: Address): string {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function activityRowSubtitle(row: TransactionRowData, title: ActivityRowCategory, userAddress: Address, addressesData: AddressesData) {
    if (title === 'Failed') {
        return row.feePayer === userAddress ? 'App Interaction' : 'Unknown';
    }
    if (title === 'Received') {
        const fromAddresses = getFromAddresses(row.events);
        if (fromAddresses.length === 0) {
            return row.feePayer === userAddress ? 'Unknown' : `From ${truncateAddress(row.feePayer)}`;
        }
        if (fromAddresses.length === 1) {
            const [fromAddress] = fromAddresses;
            const account = addressesData[fromAddress]
            return `From ${account ? account.label : truncateAddress(fromAddress)}`;
        }
        return 'From multiple addresses';
    }

    if (title === 'Sent') {
        const toAddresses = getToAddresses(row.events);
        if (toAddresses.length === 0) {
            return 'Unknown';
        }
        if (toAddresses.length === 1) {
            const [toAddress] = toAddresses;
            const account = addressesData[toAddress]
            return `To ${account ? account.label : truncateAddress(toAddress)}`;
        }
        return 'To multiple addresses';
    }

    if (row.knownApp) return row.knownApp;

    return 'Unknown';
}

type ActivityRowIconProps = {
    icon: ActivityRowIconData;
    alt: string;
};

function ActivityRowIcon({ icon, alt }: ActivityRowIconProps) {
    if (icon.kind === 'emoji') {
        return <span style={{ minWidth: '42px' }}>{icon.emoji}</span>;
    }
    return <img alt={alt} src={icon.url} height="42" width="42" />;
}

type ActivityEventProps = {
    event: TransactionRowData['events'][number];
    assetsData: AssetsData;
};

function ActivityEvent({ event, assetsData }: ActivityEventProps) {
    if (event.kind === 'received_nft') {
        return <Text c='green'>Received {getAssetFromEvent(event, assetsData).description}</Text>;
    }

    if (event.kind === 'received_sol') {
        return <Text c='green'>+{getAssetFromEvent(event, assetsData).description}</Text>;
    }

    if (event.kind === 'received_token') {
        return <Text c='green'>+{getAssetFromEvent(event, assetsData).description}</Text>;
    }

    if (event.kind === 'sent_nft') {
        return <Text c='red'>Sent {getAssetFromEvent(event, assetsData).description}</Text>;
    }

    if (event.kind === 'sent_sol') {
        return <Text c='red'>-{getAssetFromEvent(event, assetsData).description}</Text>;
    }

    if (event.kind === 'sent_token') {
        return <Text c='red'>-{getAssetFromEvent(event, assetsData).description}</Text>;
    }

    return null;
}

type ActivityEventsProps = {
    events: TransactionRowData['events'];
    assetsData: AssetsData;
};

function ActivityEvents({ events, assetsData }: ActivityEventsProps) {
    const sortedEvents = useMemo(() => [...events].sort((a, b) => {
        const eventOrder = {
            received_sol: 0,
            received_token: 1,
            received_nft: 2,
            sent_sol: 3,
            sent_token: 4,
            sent_nft: 5,
        };
        return eventOrder[a.kind] - eventOrder[b.kind];
    }), [events]);

    return (
        <div
            style={{
                padding: '2px',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
            }}
        >
            {sortedEvents.map((event, index) => (
                <ActivityEvent event={event} assetsData={assetsData} key={index} />
            ))}
        </div>
    );
}

type ActivityRowProps = {
    row: TransactionRowData;
    addressesData: AddressesData;
    assetsData: AssetsData;
};

export function TransactionRow({ row, addressesData, assetsData }: ActivityRowProps) {
    const category = activityRowCategory(row, row.feePayer);
    const asset = activityRowAsset(row, category, assetsData);
    const icon = activityRowIcon(asset, category);
    const title = activityRowTitle(category, asset);
    const subtitle = activityRowSubtitle(row, category, row.feePayer, addressesData);

    const account = addressesData[row.feePayer];

    return (
        <a href={`https://explorer.solana.com/tx/${row.signature}`} style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
            <div
                style={{
                    padding: '8px',
                    display: 'flex',
                    flexDirection: 'row',
                    gap: '1rem',
                    alignItems: 'center',
                    borderRadius: '8px',
                    backgroundColor: '#2D2B33',
                    width: '25rem',
                }}
            >
                <ActivityRowIcon icon={icon} alt={title} />
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.125rem',
                        alignSelf: 'flex-start',
                    }}
                >
                    <span>{account.label}</span>
                    <b>{title}</b>
                    <span>{subtitle}</span>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    {row.events.length > 1 ? <ActivityEvents events={row.events} assetsData={assetsData} /> : null}
                </div>
            </div>
        </a>
    );
}
