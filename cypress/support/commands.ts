export {}

declare global {
  namespace Cypress {
    interface Chainable {
      payAction()
      recursionLoop(fn: (times: number) => boolean, times?: number)
    }
  }
}

function bid() {
  cy.get("auk-item-detail-info")
    .find<HTMLInputElement>("input")
    .then((el) => {
      cy.wrap(el)
        .clear()
        .type(`${Math.round(Number(el.val()) * 1.2)}`)
    })
  cy.get("auk-item-detail-info")
    .findByRole("button", { name: /Přihodit/i })
    .click()
  cy.get("mat-dialog-container").should("be.visible").contains("Pro příhoz v aukci se přihlaste")
}

function buy() {
  cy.get("auk-item-detail-info")
    .findByRole("button", { name: /Koupit/i })
    .realClick()
  // Sometimes item is not added to basket and requires login, it needs deeper domain knowledge to handle all edge cases
  cy.get("auk-basket-control")
    .find("auk-basket-item")
    .find("a")
    .then((a) => cy.url().should("include", a.attr("href")))
}

// Cypress get/find can't easily handle element missing on purpose to do the branching in IF
function findButtonMain(name: string) {
  return Cypress.$("auk-item-detail-number-input button").text().includes(name)
}

function findButtonSide() {
  return Cypress.$("auk-item-detail-button-panel button").text().includes("Koupit")
}

Cypress.Commands.add("payAction", () => {
  if (findButtonMain("Přihodit") && !findButtonSide()) {
    bid()
  } else if (!findButtonMain("Přihodit") && findButtonMain("Koupit")) {
    buy()
  } else {
    // Item without any action (already sold) is not handled as it should be removed by filter
    Cypress._.sample([bid, buy])()
  }
})

// @ts-ignore Cypress is not properly typed, but this syntax works for repeated command. Source: https://stackoverflow.com/a/72512125
Cypress.Commands.add("recursionLoop", { times: "optional" }, (fn, times) => {
  if (typeof times === "undefined") {
    times = 0
  }
  cy.then(() => {
    const result = fn(times++)
    if (result !== false) {
      cy.recursionLoop(fn, times)
    }
  })
})
