#!/usr/bin/env python3

from argparse import ArgumentParser

from asynciojobs import Scheduler

from apssh import SshNode, SshJob
from apssh import Run

##########
gateway_hostname  = 'faraday.inria.fr'
gateway_username  = 'root'
verbose_ssh = False

# this time we want to be able to specify username and verbose_ssh
parser = ArgumentParser()
parser.add_argument("-s", "--slice", default=gateway_username,
                    help="specify an alternate slicename, default={}"
                         .format(gateway_username))
parser.add_argument("-v", "--verbose-ssh", default=False, action='store_true',
                    help="run ssh in verbose mode")
args = parser.parse_args()

gateway_username = args.slice
verbose_ssh = args.verbose_ssh

##########
faraday = SshNode(hostname = gateway_hostname, username = gateway_username,
                  verbose = verbose_ssh)

# saying gateway = faraday means to tunnel ssh through the gateway
node1 = SshNode(gateway = faraday, hostname = "fit01", username = "root",
                verbose = verbose_ssh)
##########
# create an orchestration scheduler
scheduler = Scheduler()

##########
check_lease = SshJob(
    # checking the lease is done on the gateway
    node = faraday,
    # this means that a failure in any of the commands
    # will cause the scheduler to bail out immediately
    critical = True,
    command = Run("rhubarbe leases --check"),
    scheduler = scheduler,
)

# the command we want to run in node1 is as simple as it gets
ping = SshJob(
    node = faraday,
    # this says that we wait for check_lease to finish before we start ping
    required = check_lease,
    command = Run('baleine', 'deploy', '--nodes', node1.hostname, '--image', 'ghcr.io/haysberg/baleine:main', '--command', 'ping -c1 google.fr'),
    scheduler = scheduler)

##########
# how to run the same directly with ssh - for troubleshooting
print("""--- for troubleshooting:
ssh -i /dev/null {}@{} ssh root@fit01 ping -c1 google.fr
---""".format(gateway_username, gateway_hostname))

##########
# run the scheduler
ok = scheduler.orchestrate()

# give details if it failed
ok or scheduler.debrief()

# return something useful to your OS
exit(0 if ok else 1)
