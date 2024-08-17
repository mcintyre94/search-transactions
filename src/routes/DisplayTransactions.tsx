import { ActionFunctionArgs, Form, LoaderFunctionArgs, useActionData, useLoaderData, useSubmit } from "react-router-dom"
import { getAddressQueryData } from "../queries/addressQueries"
import { getAssetsQueryData } from "../queries/assetQueries"
import { AppShell, Badge, Checkbox, Container, CopyButton, Group, ScrollArea, Stack, Text } from "@mantine/core"
import React, { useCallback, useMemo } from "react"
import { QueryClient, useIsRestoring, useQueries, useQuery } from "@tanstack/react-query"
import { queryClient } from "../query-client"
import { Address } from "@solana/web3.js"
import { useClipboard } from "@mantine/hooks"
import { IconCopy } from "@tabler/icons-react"

type ActionData = {
    selectedAddresses: Address[];
}

export async function action({ request }: ActionFunctionArgs): Promise<ActionData> {
    const formData = await request.formData();
    const selectedAddresses = formData.getAll('selectedAddresses') as Address[];

    return {
        selectedAddresses
    }
}

function TruncatedAddressWithCopy({ address }: { address: Address }) {
    return (
        <CopyButton value={address}>
            {({ copied, copy }) => (
                <Group>
                    <Text size='md' c='dimmed'>({address.slice(0, 4)}...{address.slice(address.length - 4)})</Text>
                    {copied ? <Text>Copied</Text> : <IconCopy onClick={(e) => {
                        e.preventDefault();
                        copy();
                    }} />}
                </Group>
            )}
        </CopyButton>
    )
}

type AddressLabelProps = {
    label: string;
    address: Address;
    tags: string[];
}
function AddressLabel({ label, address, tags }: AddressLabelProps) {
    return (
        <Stack gap='xs'>
            <Group>
                <Text size='lg'>{label}</Text>
                <TruncatedAddressWithCopy address={address} />
            </Group>
            <Group gap='xs'>
                {tags.map(tag => <Badge key={tag} size='xs' color='gray'>{tag}</Badge>)}
            </Group>
        </Stack>

    )
}

type AddressCheckboxesProps = {
    addresses: ReturnType<typeof getAddressQueryData>,
    selectedAddresses: Set<Address>,
}
function AddressCheckboxes({ addresses, selectedAddresses }: AddressCheckboxesProps) {
    const submit = useSubmit();

    return (
        <Form method="POST" onChange={(e) => {
            console.log('submitting form...');
            submit(e.currentTarget)
        }}>
            <Stack gap='lg'>
                {Object.entries(addresses).map(([address, data]) => (
                    <Checkbox
                        key={address}
                        name="selectedAddresses"
                        value={address}
                        defaultChecked={selectedAddresses.has(address as Address)}
                        label={<AddressLabel label={data.label} address={address as Address} tags={data.tags} />}
                    />
                ))}
            </Stack>
        </Form >
    )
}

export default function DisplayTransactions() {
    // Since we restore the query client, the loader is too early to fetch this data
    // We wait for the restore to be done and then fetch it here
    const actionData = useActionData() as ActionData | undefined;
    const selectedAddresses = new Set(actionData?.selectedAddresses ?? []);

    const restoring = useIsRestoring();
    const { addresses, assets } = useMemo(() => ({
        addresses: getAddressQueryData(),
        assets: getAssetsQueryData(),
    }), [restoring]);

    const filteredAddresses = actionData ? Object.fromEntries(
        Object.entries(addresses).filter(([address]) => selectedAddresses.has(address as Address))
    ) : addresses;

    return (
        <AppShell
            header={{ height: 60 }}
            navbar={{
                width: 400,
                breakpoint: "sm"
            }}
            padding="md"
        >
            <AppShell.Header></AppShell.Header>

            <AppShell.Navbar>
                <ScrollArea>
                    <Container py={12}>
                        <AddressCheckboxes addresses={addresses} selectedAddresses={actionData ? selectedAddresses : new Set(Object.keys(addresses) as Address[])} />
                    </Container>
                </ScrollArea>
            </AppShell.Navbar>

            <AppShell.Main>
                {Object.entries(filteredAddresses).map(([address, data]) => (
                    <Text key={address}>{data.label} has {data.summarisedTransactions.length} transactions</Text>
                ))}
            </AppShell.Main>
        </AppShell>
    )
}