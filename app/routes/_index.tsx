import type { MetaFunction } from "@remix-run/node";
import { Form, useActionData, useSubmit } from "react-router-dom"
import { getAddressQueryData } from "../queries/addressQueries"
import { getAssetsQueryData } from "../queries/assetQueries"
import { AppShell, Badge, Button, Checkbox, Container, CopyButton, Group, Loader, PasswordInput, ScrollArea, Stack, Text, TextInput } from "@mantine/core"
import { useMemo } from "react"
import { useIsRestoring } from "@tanstack/react-query"
import { Address, Signature } from "@solana/web3.js"
import { IconCopy } from "@tabler/icons-react"
import { TransactionSummary } from "../helius/summarise-transaction"
import { ClientActionFunctionArgs, useFetcher } from "@remix-run/react";
import { TransactionRow } from "~/components/TransactionRow";
import { applyFilter, Filter } from "~/filters/filter-summaries";
import { d } from "node_modules/@tanstack/react-query-devtools/build/modern/devtools-PtxSnd7z";


export const meta: MetaFunction = () => {
  return [
    { title: "View and search parsed transactions" },
  ];
};

type ActionData = {
  selectedAddresses: Address[];
}

export async function clientAction({ request }: ClientActionFunctionArgs): Promise<ActionData> {
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
          {copied ? <Text>Copied</Text> : <IconCopy onClick={(e: { preventDefault: () => void; }) => {
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

type DateString = string;

type TransactionRow = {
  dateAsYyyymmdd: DateString;
  signature: Signature;
  feePayer: Address;
  success: boolean;
  knownApp: TransactionSummary['knownApp'];
  events: TransactionSummary['events'];
};

function createTransactionRowForSummary(transactionSummary: TransactionSummary): TransactionRow {
  const date = new Date(transactionSummary.timestamp * 1000);

  return {
    dateAsYyyymmdd: date.toISOString().split('T')[0],
    signature: transactionSummary.signature,
    feePayer: transactionSummary.feePayer,
    success: transactionSummary.success,
    knownApp: transactionSummary.knownApp,
    events: transactionSummary.events,
  };
}

type GroupedDates = {
  dateAsYyyymmdd: string;
  rows: TransactionRow[];
}[];

function groupByDate(rows: TransactionRow[]): GroupedDates {
  if (rows.length === 0) return [];

  const groupedDates: GroupedDates = [];

  for (const row of rows) {
    const lastGroup = groupedDates[groupedDates.length - 1];
    if (lastGroup?.dateAsYyyymmdd === row.dateAsYyyymmdd) {
      lastGroup.rows.push(row);
      continue;
    }

    groupedDates.push({
      dateAsYyyymmdd: row.dateAsYyyymmdd,
      rows: [row],
    });
  }

  return groupedDates;
}

function formatDate(dateAsYyyymmdd: string) {
  const activityDate = new Date(dateAsYyyymmdd);
  const today = new Date();
  // Remove the time part for accurate date comparison
  today.setHours(0, 0, 0, 0);

  // Calculate the difference in days
  const oneDayInMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.ceil((today.getTime() - activityDate.getTime()) / oneDayInMs);

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  }
  // Format the date as 5 Aug, 2024
  return activityDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type AssetsData = ReturnType<typeof getAssetsQueryData>;
type AddressesData = ReturnType<typeof getAddressQueryData>;

type ActivityGroupProps = {
  dateAsYyyymmdd: string;
  rows: TransactionRow[];
  addressesData: AddressesData;
  assetsData: AssetsData;
};

function TransactionGroup({ dateAsYyyymmdd, rows, addressesData, assetsData }: ActivityGroupProps) {
  return (
    <div>
      <p>{formatDate(dateAsYyyymmdd)}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {rows.map((row, i) => (
          <TransactionRow row={row} addressesData={addressesData} assetsData={assetsData} key={i} />
        ))}
      </div>
    </div>
  );
}

type TransactionsProps = {
  transactionSummaries: TransactionSummary[];
  assetsData: AssetsData;
  addressesData: AddressesData
}
function Transactions({ transactionSummaries, assetsData, addressesData }: TransactionsProps) {
  const sortedTransactionSummaries = useMemo(() => transactionSummaries.sort((a, b) => b.timestamp - a.timestamp), [transactionSummaries]);

  const groupedTransactionRows = useMemo(() => {
    const rows = sortedTransactionSummaries.map((t) => createTransactionRowForSummary(t));
    const grouped = groupByDate(rows);
    return grouped;
  }, [sortedTransactionSummaries]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {groupedTransactionRows.map(({ dateAsYyyymmdd, rows }, i) => (
        <TransactionGroup
          dateAsYyyymmdd={dateAsYyyymmdd}
          rows={rows}
          assetsData={assetsData}
          addressesData={addressesData}
          key={i}
        />
      ))}
    </div>
  );
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
    // explanation: want to use restoring to re-fetch after restoring the DB
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [restoring]);

  const filteredAddresses = actionData ? Object.fromEntries(
    Object.entries(addresses).filter(([address]) => selectedAddresses.has(address as Address))
  ) : addresses;

  const transactionsForSelectedAddresses = Object.values(filteredAddresses).flatMap(t => t.summarisedTransactions)

  const fetcher = useFetcher();

  if (fetcher.data) {
    console.log({ fetcherData: fetcher.data });
  }

  const filteredTransactions = fetcher.data ? applyFilter(transactionsForSelectedAddresses, fetcher.data as Filter, addresses, assets) : transactionsForSelectedAddresses;

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
        <Container>
          <Stack gap='lg'>
            <fetcher.Form method="POST" action="/api/generate-filters">
              <Stack gap='md'>
                <TextInput
                  label="Filter Transactions"
                  placeholder="show transactions to Jupiter in the last week"
                  name="filterDescription"
                  autoComplete="off"
                  required
                />
                <Group><Button type='submit' disabled={fetcher.state === "submitting"}>Filter</Button></Group>
              </Stack>
            </fetcher.Form>

            {fetcher.state === "submitting" ? <Loader /> :
              <Transactions transactionSummaries={filteredTransactions} assetsData={assets} addressesData={addresses} />
            }
          </Stack>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
