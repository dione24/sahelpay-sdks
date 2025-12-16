# Guide de publication du SDK SahelPay

Ce guide explique comment publier une nouvelle version du SDK `@sahelpay/sdk` sur le registre NPM.

## Prérequis

1.  **Compte NPM** : Vous devez avoir un compte sur [npmjs.com](https://www.npmjs.com/).
2.  **Organisation** : Si le package est sous le scope `@sahelpay`, vous devez faire partie de l'organisation `sahelpay` sur NPM ou créer cette organisation.
3.  **Connexion** : Assurez-vous d'être connecté à NPM via votre terminal :
    ```bash
    npm login
    ```

## Étapes de publication

### 1. Préparation et Tests

Avant de publier, assurez-vous que tout fonctionne correctement :

```bash
cd sdks/javascript
npm install
npm run test  # Si des tests sont configurés
npm run build # Vérifier que le build passe
```

### 2. Mise à jour de la version

Mettez à jour la version dans `package.json`. Vous pouvez utiliser `npm version` pour cela :

```bash
# Pour un patch (1.0.0 -> 1.0.1)
npm version patch

# Pour une mineure (1.0.0 -> 1.1.0)
npm version minor

# Pour une majeure (1.0.0 -> 2.0.0)
npm version major
```

Cette commande mettra à jour `package.json` et créera un commit/tag git automatiquement si vous êtes dans un dépôt git.

### 3. Publication

Publiez le package sur le registre NPM public.

> **Note** : Comme c'est un package scopé (`@sahelpay/...`), il est privé par défaut. Pour le rendre public (gratuit), il faut ajouter `--access public`.

```bash
npm publish --access public
```

Si vous avez activé l'authentification à deux facteurs (2FA) sur NPM, un code vous sera demandé.

## Automatisation (CI/CD)

Pour automatiser ce processus via GitHub Actions, vous pouvez utiliser le fichier de workflow suivant (`.github/workflows/publish-sdk.yml`) :

```yaml
name: Publish SDK

on:
  release:
    types: [created]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20.x'
          registry-url: 'https://registry.npmjs.org'
      
      - run: npm ci
        working-directory: ./sdks/javascript
        
      - run: npm run build
        working-directory: ./sdks/javascript
        
      - run: npm publish --access public
        working-directory: ./sdks/javascript
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Il faudra ajouter le secret `NPM_TOKEN` dans les paramètres de votre dépôt GitHub.
