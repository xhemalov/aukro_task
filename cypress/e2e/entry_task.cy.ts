/*
  1. Cypress doesn't handle well non-blocking operations for randomly appearing elements.
  2. We need to use native Javascript, but it has to be injected to the page.
  3. MutationObserver watched for changes in DOM and when it finds popup window matching conditions
     it closes it and removes the observer, because also login popup is modal.
*/
function dismissWindowWatcher() {
  cy.window().then((win) => {
    const script = win.document.createElement("script")
    script.id = "muj-vlozeny-script"
    script.textContent = `
        const observer = new MutationObserver((mutationsList) => {
          for (const mutation of mutationsList) {
            if (mutation.type === "childList") {
              const overlayElement = document.querySelector("auk-email-collector-popup")
              if (overlayElement) {
                overlayElement.querySelector("i").click()
                observer.disconnect()
              }
            }
          }
        })

        const observerConfig = { childList: true, subtree: true }
        observer.observe(document, observerConfig)
      `
    win.document.head.appendChild(script)
  })
}

it("task", () => {
  // Most common resolution + Aukro works the best
  cy.viewport(1920, 1080)
  cy.visit("/")
  dismissWindowWatcher()

  cy.step("Confirm cookies")
  // Might be better to handle this with regex
  cy.findByRole("button", { name: /Souhlasit a zavřít: Souhlasit s naším zpracováním údajů a zavřít/i }).click()

  cy.step("Choose category")
  cy.get("auk-header-navbar")
    .find("auk-top-level-category")
    .then((elems) => {
      let cardNumber: number
      const count = elems.length
      // Cypress doesn't allow while, so we need to create custom command to go through repeated actions and do the validations
      cy.recursionLoop((times) => {
        cy.intercept("POST", "https://aukro.cz/backend-web/api/offers/searchItemsCommon?page=0&size=60&sort=").as(
          `searchPOST${times}`,
        )
        cy.get("auk-header-navbar").find("auk-top-level-category").eq(times).realClick()
        cy.wait(`@searchPOST${times}`)
        cy.intercept("POST", "https://aukro.cz/backend-web/api/offers/searchItemsCommon?page=0&size=60&sort=").as(
          `searchWithFilterPOST${times}`,
        )
        cy.findByRole("checkbox", { name: /Garance vrácení peněz/i }).realClick()
        cy.wait(`@searchWithFilterPOST${times}`)
          .its("request.body")
          .then((body) => expect(body.paymentViaAukro).eq(true))
        cy.get("auk-list-view")
          .find("auk-list-card")
          .then((cards) => {
            cardNumber = cards.length
          })
        // Either go through all categories or find one with more than 4 items after filter is activated
        return cardNumber <= 4 && count - 1 !== times
      })
    })

  cy.step("All offers have guarantee")
  // Cypress is too fast, not all items are mounted to DOM
  cy.wait(1000)
  cy.get("auk-list-view")
    .find("auk-list-card")
    // Randomly appearing modal window breaks cypress command .each
    .then((elems) => {
      const count = elems.length
      cy.recursionLoop((times) => {
        // JavaScript queue - microtask macrotask
        cy.wait(0)
        cy.get("auk-list-view").find("auk-list-card").eq(times).find("#money-back-guarantee2").should("be.visible")
        return count - 1 !== times
      })
    })

  cy.step("Choose offer")
  cy.get("auk-list-view")
    .find("auk-list-card")
    .then((elems) => {
      const count = elems.length
      cy.get("auk-list-card")
        // Choose which item to pick based on the task
        .eq(count % 2 === 1 ? Math.round(count / 2 - 1) : Cypress._.random(count - 1))
        .find("a")
        // Multiple links within list-card
        .first()
        .click()
    })

  cy.step("Check offer guarantee")
  cy.get("auk-item-detail-premium-banners")
    .find("auk-banner-payment-via-aukro")
    .find("#money-back-guarantee")
    .should("be.visible")

  cy.step("Choose pay action")
  cy.payAction()
})
