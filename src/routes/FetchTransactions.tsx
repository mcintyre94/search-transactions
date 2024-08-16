import { Button, Container, Fieldset, FileInput, Group, PasswordInput, Stack } from "@mantine/core";
import React from "react";
import { ActionFunctionArgs, Form } from "react-router-dom";
import { z } from "zod";
import { OrbitAccount, orbitAccountSchema } from "../orbit-accounts/orbitAccount";
import { createHeliusRpc } from "../helius/rpc/rpc";
import { address } from "@solana/web3.js";

type FormDataUpdates = {
    heliusApiKey: string;
    orbitAccounts: File;
}

export async function action({ request }: ActionFunctionArgs) {
    const formData = await request.formData();
    // formData doesn't include files
    const updates = Object.fromEntries(formData) as unknown as FormDataUpdates;

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
    const transactions = await heliusRpc.getTransactionHistory({ address: accounts[0].address, commitment: 'confirmed', limit: 10 }).send({ abortSignal: request.signal });
    // const assets = await heliusRpc.getAssetBatch({ ids: [address('DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'), address('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')] }).send({ abortSignal: request.signal });

    console.log({ transactions });


    return 'ok';
}

export default function FetchTransactions() {
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

                    <Group><Button type="submit">Fetch transactions</Button></Group>
                </Stack>
            </Form>
        </Container>
    )
}