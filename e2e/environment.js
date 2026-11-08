const {
  DetoxCircusEnvironment,
} = require('detox/runners/jest');

class CustomDetoxEnvironment extends DetoxCircusEnvironment {
  constructor(config, context) {
    super(config, context);
    this.initTimeout = 300000;
  }
}

module.exports = CustomDetoxEnvironment;
