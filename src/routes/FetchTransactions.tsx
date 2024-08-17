import { Button, Container, FileInput, Group, PasswordInput, Stack } from "@mantine/core";
import { DateInput } from "@mantine/dates"
import React, { useMemo } from "react";
import { ActionFunctionArgs, Form } from "react-router-dom";
import { z } from "zod";
import { OrbitAccount, orbitAccountSchema } from "../orbit-accounts/orbitAccount";
import { createHeliusRpc } from "../helius/rpc/rpc";

import "@mantine/dates/styles.css";
import { fetchAndSaveAddressQueryData, getAddressQueryData } from "../queries/addressQueries";


type FormDataUpdates = {
    heliusApiKey: string;
    orbitAccounts: File;
    fetchSince: string;
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    // formData doesn't include files
    const updates = Object.fromEntries(formData) as unknown as FormDataUpdates;

    console.log(updates, updates.fetchSince, typeof updates.fetchSince);
    // return 'ok';

    // validate the file as a list of accounts
    // if any issues (including invalid addresses), just error, user probably chose the wrong file
    const accountsSchema = z.array(orbitAccountSchema);
    let accounts: OrbitAccount[] = [];
    try {
        accounts = accountsSchema.parse(JSON.parse(await updates.orbitAccounts.text())) as OrbitAccount[];
    } catch (e) {
        // parse error
        console.error({ e });
        return { responseType: 'error', error: 'Invalid file, does not contain accounts' }
    }

    const heliusRpc = createHeliusRpc(updates.heliusApiKey);
    const fetchSinceDate = new Date(updates.fetchSince);

    for (const account of accounts) {
        console.log(`Fetching transaction data for ${account.address}`);
        await fetchAndSaveAddressQueryData(account, heliusRpc, fetchSinceDate);
    }

    const addressData = getAddressQueryData();

    console.log({ addressData });

    return 'ok';
}

function getStartOfYearDate() {
    const date = new Date();
    date.setMonth(0);
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    return date;
}

export default function FetchTransactions() {
    const startOfYearDate = useMemo(() => getStartOfYearDate(), []);

    return (
        <Container py={32}>
            <Form method='post' encType='multipart/form-data'>
                <Stack gap='lg'>
                    <PasswordInput
                        label="Helius API key"
                        description="Will be used to fetch transaction history"
                        name="heliusApiKey"
                        autoComplete="off"
                        required
                    />

                    <FileInput
                        label="Orbit accounts"
                        description="Upload account JSON exported from Orbit"
                        name="orbitAccounts"
                        accept="application/json"
                        clearable
                        required
                    />

                    <DateInput
                        label="Fetch since"
                        description="Fetch transactions since this date. Earlier dates will fetch more transactions, which will use more Helius RPC requests and take longer"
                        name="fetchSince"
                        clearable
                        required
                        defaultDate={startOfYearDate}
                        minDate={new Date(2020, 4, 16)}
                        valueFormat="DD MMM YYYY HH:mm"
                    />


                    <Group><Button type="submit">Fetch transactions</Button></Group>
                </Stack>
            </Form>
        </Container>
    )
}