module suipaylink::escrow;

use std::string::String;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, UID};
#[test_only]
use sui::sui::SUI;
#[test_only]
use sui::test_scenario;
use sui::transfer;
use sui::tx_context::{Self, TxContext};

const E_NOT_BUYER: u64 = 1;
const E_NOT_SELLER: u64 = 2;
const E_NOT_FUNDED: u64 = 3;
const E_ALREADY_RELEASED: u64 = 4;
const E_ALREADY_REFUNDED: u64 = 5;
const E_INVALID_FEE_BPS: u64 = 6;
const E_ZERO_AMOUNT: u64 = 7;
const E_NOT_DELIVERED: u64 = 8;
const E_ALREADY_DELIVERED: u64 = 9;

const MAX_FEE_BPS: u64 = 1000;

/// Public immutable metadata for an invoice link.
public struct Invoice has key, store {
    id: UID,
    seller: address,
    buyer: address,
    memo: String,
    amount: u64,
    currency_type: String,
    created_ms: u64,
}

/// Escrow state for one service transaction.
///
/// Generic `T` is the payment coin type, for example a supported Sui stablecoin.
public struct Escrow<phantom T> has key, store {
    id: UID,
    seller: address,
    buyer: address,
    memo: String,
    amount: u64,
    fee_bps: u64,
    fee_receiver: address,
    delivery_proof_uri: String,
    funded: bool,
    delivered: bool,
    released: bool,
    refunded: bool,
    funds: Balance<T>,
}

public struct InvoiceCreated has copy, drop {
    invoice_id: address,
    seller: address,
    buyer: address,
    amount: u64,
}

public struct EscrowCreated has copy, drop {
    escrow_id: address,
    seller: address,
    buyer: address,
    amount: u64,
}

public struct EscrowFunded has copy, drop {
    escrow_id: address,
    buyer: address,
    amount: u64,
}

public struct DeliveryMarked has copy, drop {
    escrow_id: address,
    seller: address,
}

public struct EscrowReleased has copy, drop {
    escrow_id: address,
    seller: address,
    amount_to_seller: u64,
    fee_amount: u64,
}

public struct EscrowRefunded has copy, drop {
    escrow_id: address,
    buyer: address,
    amount: u64,
}

/// Create a simple invoice object for direct payment links and receipts.
public fun create_invoice(
    seller: address,
    buyer: address,
    memo: String,
    amount: u64,
    currency_type: String,
    created_ms: u64,
    ctx: &mut TxContext,
) {
    assert!(amount > 0, E_ZERO_AMOUNT);

    let invoice = Invoice {
        id: object::new(ctx),
        seller,
        buyer,
        memo,
        amount,
        currency_type,
        created_ms,
    };

    let invoice_id = object::uid_to_address(&invoice.id);
    event::emit(InvoiceCreated {
        invoice_id,
        seller,
        buyer,
        amount,
    });
    transfer::public_transfer(invoice, seller);
}

/// Create and fund an escrow in a single transaction.
/// The caller must provide the payment coin, while gas can be sponsored by the platform.
public fun create_funded_escrow<T>(
    seller: address,
    memo: String,
    payment: Coin<T>,
    fee_bps: u64,
    fee_receiver: address,
    ctx: &mut TxContext,
) {
    let buyer = tx_context::sender(ctx);
    let amount = coin::value(&payment);
    assert!(amount > 0, E_ZERO_AMOUNT);
    assert!(fee_bps <= MAX_FEE_BPS, E_INVALID_FEE_BPS);

    let escrow = Escrow<T> {
        id: object::new(ctx),
        seller,
        buyer,
        memo,
        amount,
        fee_bps,
        fee_receiver,
        delivery_proof_uri: std::string::utf8(b""),
        funded: true,
        delivered: false,
        released: false,
        refunded: false,
        funds: coin::into_balance(payment),
    };

    let escrow_id = object::uid_to_address(&escrow.id);
    event::emit(EscrowCreated {
        escrow_id,
        seller,
        buyer,
        amount,
    });
    event::emit(EscrowFunded {
        escrow_id,
        buyer,
        amount,
    });
    transfer::public_share_object(escrow);
}

/// Seller marks delivery and attaches an off-chain proof URI.
/// The proof URI can later point to Walrus, IPFS, or a normal HTTPS artifact.
public fun mark_delivered<T>(
    escrow: &mut Escrow<T>,
    delivery_proof_uri: String,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == escrow.seller, E_NOT_SELLER);
    assert!(escrow.funded, E_NOT_FUNDED);
    assert!(!escrow.released, E_ALREADY_RELEASED);
    assert!(!escrow.refunded, E_ALREADY_REFUNDED);
    assert!(!escrow.delivered, E_ALREADY_DELIVERED);

    escrow.delivered = true;
    escrow.delivery_proof_uri = delivery_proof_uri;

    event::emit(DeliveryMarked {
        escrow_id: object::uid_to_address(&escrow.id),
        seller: escrow.seller,
    });
}

/// Buyer releases escrow funds to seller and platform fee receiver.
public fun release<T>(
    escrow: &mut Escrow<T>,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == escrow.buyer, E_NOT_BUYER);
    assert!(escrow.funded, E_NOT_FUNDED);
    assert!(!escrow.released, E_ALREADY_RELEASED);
    assert!(!escrow.refunded, E_ALREADY_REFUNDED);
    assert!(escrow.delivered, E_NOT_DELIVERED);

    let fee_amount = escrow.amount * escrow.fee_bps / 10000;
    let seller_amount = escrow.amount - fee_amount;

    let fee_balance = balance::split(&mut escrow.funds, fee_amount);
    let seller_balance = balance::split(&mut escrow.funds, seller_amount);

    transfer::public_transfer(coin::from_balance(fee_balance, ctx), escrow.fee_receiver);
    transfer::public_transfer(coin::from_balance(seller_balance, ctx), escrow.seller);

    escrow.released = true;

    event::emit(EscrowReleased {
        escrow_id: object::uid_to_address(&escrow.id),
        seller: escrow.seller,
        amount_to_seller: seller_amount,
        fee_amount,
    });
}

/// Buyer can refund while MVP has no arbitration.
/// Production rules should add deadlines, seller acceptance, or dispute policy.
public fun refund_to_buyer<T>(
    escrow: &mut Escrow<T>,
    ctx: &mut TxContext,
) {
    assert!(tx_context::sender(ctx) == escrow.buyer, E_NOT_BUYER);
    assert!(escrow.funded, E_NOT_FUNDED);
    assert!(!escrow.released, E_ALREADY_RELEASED);
    assert!(!escrow.refunded, E_ALREADY_REFUNDED);

    let refund_balance = balance::withdraw_all(&mut escrow.funds);
    transfer::public_transfer(coin::from_balance(refund_balance, ctx), escrow.buyer);
    escrow.refunded = true;

    event::emit(EscrowRefunded {
        escrow_id: object::uid_to_address(&escrow.id),
        buyer: escrow.buyer,
        amount: escrow.amount,
    });
}

#[test_only]
const TEST_BUYER: address = @0xB0B;
#[test_only]
const TEST_SELLER: address = @0xA11CE;
#[test_only]
const TEST_FEE_RECEIVER: address = @0xFEE;
#[test_only]
const TEST_AMOUNT: u64 = 10000;
#[test_only]
const TEST_FEE_BPS: u64 = 100;

#[test_only]
fun test_string(bytes: vector<u8>): String {
    std::string::utf8(bytes)
}

#[test_only]
fun create_test_escrow(scenario: &mut test_scenario::Scenario, amount: u64, fee_bps: u64) {
    let payment = coin::mint_for_testing<SUI>(amount, scenario.ctx());
    create_funded_escrow<SUI>(
        TEST_SELLER,
        test_string(b"design sprint escrow"),
        payment,
        fee_bps,
        TEST_FEE_RECEIVER,
        scenario.ctx(),
    );
}

#[test]
fun funded_escrow_releases_to_seller_and_fee_receiver() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_SELLER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    assert!(escrow.buyer == TEST_BUYER, 100);
    assert!(escrow.seller == TEST_SELLER, 101);
    assert!(escrow.amount == TEST_AMOUNT, 102);
    assert!(escrow.fee_bps == TEST_FEE_BPS, 103);
    assert!(escrow.funded, 104);
    assert!(!escrow.delivered, 105);
    assert!(!escrow.released, 106);
    assert!(!escrow.refunded, 107);
    assert!(balance::value(&escrow.funds) == TEST_AMOUNT, 108);
    mark_delivered<SUI>(&mut escrow, test_string(b"https://proof.example/delivery"), scenario.ctx());
    assert!(escrow.delivered, 109);
    test_scenario::return_shared(escrow);

    scenario.next_tx(TEST_BUYER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    release<SUI>(&mut escrow, scenario.ctx());
    assert!(escrow.released, 110);
    assert!(balance::value(&escrow.funds) == 0, 111);
    test_scenario::return_shared(escrow);

    scenario.next_tx(TEST_SELLER);
    let seller_coin = scenario.take_from_address<Coin<SUI>>(TEST_SELLER);
    assert!(coin::burn_for_testing<SUI>(seller_coin) == 9900, 112);

    scenario.next_tx(TEST_FEE_RECEIVER);
    let fee_coin = scenario.take_from_address<Coin<SUI>>(TEST_FEE_RECEIVER);
    assert!(coin::burn_for_testing<SUI>(fee_coin) == 100, 113);

    scenario.end();
}

#[test]
fun funded_escrow_refunds_to_buyer() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_BUYER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    refund_to_buyer<SUI>(&mut escrow, scenario.ctx());
    assert!(escrow.refunded, 200);
    assert!(balance::value(&escrow.funds) == 0, 201);
    test_scenario::return_shared(escrow);

    scenario.next_tx(TEST_BUYER);
    let buyer_coin = scenario.take_from_address<Coin<SUI>>(TEST_BUYER);
    assert!(coin::burn_for_testing<SUI>(buyer_coin) == TEST_AMOUNT, 202);

    scenario.end();
}

#[test, expected_failure(abort_code = E_ZERO_AMOUNT)]
fun create_escrow_rejects_zero_amount() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, 0, TEST_FEE_BPS);
    scenario.end();
}

#[test, expected_failure(abort_code = E_INVALID_FEE_BPS)]
fun create_escrow_rejects_fee_above_cap() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, MAX_FEE_BPS + 1);
    scenario.end();
}

#[test, expected_failure(abort_code = E_NOT_SELLER)]
fun buyer_cannot_mark_delivery() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_BUYER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    mark_delivered<SUI>(&mut escrow, test_string(b"https://proof.example/bad"), scenario.ctx());
    test_scenario::return_shared(escrow);
    scenario.end();
}

#[test, expected_failure(abort_code = E_NOT_DELIVERED)]
fun buyer_cannot_release_before_delivery() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_BUYER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    release<SUI>(&mut escrow, scenario.ctx());
    test_scenario::return_shared(escrow);
    scenario.end();
}

#[test, expected_failure(abort_code = E_NOT_BUYER)]
fun seller_cannot_release() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_SELLER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    mark_delivered<SUI>(&mut escrow, test_string(b"https://proof.example/delivery"), scenario.ctx());
    test_scenario::return_shared(escrow);

    scenario.next_tx(TEST_SELLER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    release<SUI>(&mut escrow, scenario.ctx());
    test_scenario::return_shared(escrow);
    scenario.end();
}

#[test, expected_failure(abort_code = E_ALREADY_DELIVERED)]
fun seller_cannot_mark_delivery_twice() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_SELLER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    mark_delivered<SUI>(&mut escrow, test_string(b"https://proof.example/one"), scenario.ctx());
    mark_delivered<SUI>(&mut escrow, test_string(b"https://proof.example/two"), scenario.ctx());
    test_scenario::return_shared(escrow);
    scenario.end();
}

#[test, expected_failure(abort_code = E_ALREADY_RELEASED)]
fun buyer_cannot_release_twice() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_SELLER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    mark_delivered<SUI>(&mut escrow, test_string(b"https://proof.example/delivery"), scenario.ctx());
    test_scenario::return_shared(escrow);

    scenario.next_tx(TEST_BUYER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    release<SUI>(&mut escrow, scenario.ctx());
    release<SUI>(&mut escrow, scenario.ctx());
    test_scenario::return_shared(escrow);
    scenario.end();
}

#[test, expected_failure(abort_code = E_ALREADY_REFUNDED)]
fun buyer_cannot_release_after_refund() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_BUYER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    refund_to_buyer<SUI>(&mut escrow, scenario.ctx());
    release<SUI>(&mut escrow, scenario.ctx());
    test_scenario::return_shared(escrow);
    scenario.end();
}

#[test, expected_failure(abort_code = E_ALREADY_RELEASED)]
fun buyer_cannot_refund_after_release() {
    let mut scenario = test_scenario::begin(TEST_BUYER);
    create_test_escrow(&mut scenario, TEST_AMOUNT, TEST_FEE_BPS);

    scenario.next_tx(TEST_SELLER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    mark_delivered<SUI>(&mut escrow, test_string(b"https://proof.example/delivery"), scenario.ctx());
    test_scenario::return_shared(escrow);

    scenario.next_tx(TEST_BUYER);
    let mut escrow = scenario.take_shared<Escrow<SUI>>();
    release<SUI>(&mut escrow, scenario.ctx());
    refund_to_buyer<SUI>(&mut escrow, scenario.ctx());
    test_scenario::return_shared(escrow);
    scenario.end();
}
